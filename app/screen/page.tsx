"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import AuctionArea from "@/components/auction/AuctionArea";
import LiveScreen from "@/components/auction/LiveScreen";
import { createPendingSettlementRecords } from "@/lib/accounting/accountingFacade";
import {
  getEscrowSettlementReflectionSnapshot,
  getReflectedSettledAmount,
  subscribeToEscrowSettlementReflection,
  syncEscrowCycleBaseline,
} from "@/lib/accounting/escrowSettlementReflection";
import { deriveActiveSlotReservedAmount } from "@/lib/accounting/slotReservedAmount";
import {
  getSettlementRecordSnapshot,
  listBrowserSettlementRecords,
  notifySettlementRecordsChanged,
  subscribeToSettlementRecordChanges,
} from "@/lib/accounting/settlementRecordSync";
import {
  markSettlementFailed,
  markSettlementProcessing,
  markSettlementSettled,
  type SettlementRecord,
} from "@/lib/accounting/settlementRecords";
import {
  createBrowserSettlementRepository,
  type SettlementRepository,
} from "@/lib/accounting/settlementRepository";
import { ARC_TREASURY_ADDRESS } from "@/lib/arc/arcConfig";
import {
  ARC_CHAIN_ID,
  ARC_USDC_CONTRACT_ADDRESS,
} from "@/lib/arc/arcConstants";
import { getArcEscrowAddress } from "@/lib/arc/arcEscrowConfig";
import { AUCTION_TOTAL_CYCLE_SECONDS } from "@/lib/auction/constants";
import {
  getConfirmedBidExposure,
  getSettlementEligibleLiveSlotIds,
  syncTemporaryAuctionReservations,
  useDemoAuctionStore,
  useTemporaryReservedAmount,
} from "@/lib/auction";
import {
  useWalletEscrowBalance,
  useWalletStore,
  useWalletUsdcBalance,
} from "@/lib/wallet";

const ACCOUNTING_SLOT_IDS = ["slot-1", "slot-2", "slot-3"] as const;
const MISSING_BID_AUTHORIZATION_REASON =
  "Settlement is missing bid authorization and cannot be processed.";

type OperatorProcessResponse = {
  ok: boolean;
  status?: "settled" | "already_settled";
  transactionHash?: `0x${string}`;
  error?: string;
};

function serializeSettlementRecord(record: SettlementRecord) {
  return {
    ...record,
    result: {
      ...record.result,
      amountMinorUnits: record.result.amountMinorUnits.toString(),
    },
  };
}

function markMissingBidAuthorization(record: SettlementRecord): SettlementRecord {
  return {
    ...record,
    status: "failed",
    updatedAt: new Date().toISOString(),
    failureReason: MISSING_BID_AUTHORIZATION_REASON,
  };
}

async function processSettlementRecord(
  repository: SettlementRepository,
  record: SettlementRecord,
  onRepositoryChange?: () => void,
  onSettlementComplete?: () => void
) {
  if (record.status !== "pending" && record.status !== "failed") {
    return;
  }

  if (!record.result.bidAuthorization) {
    if (
      record.status === "failed" &&
      record.failureReason === MISSING_BID_AUTHORIZATION_REASON
    ) {
      return;
    }

    repository.update(markMissingBidAuthorization(record));
    onRepositoryChange?.();
    return;
  }

  const processingRecord = markSettlementProcessing(
    record,
    new Date().toISOString()
  );
  repository.update(processingRecord);
  onRepositoryChange?.();

  try {
    const response = await fetch("/api/operator/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serializeSettlementRecord(processingRecord)),
    });
    const result = (await response.json()) as OperatorProcessResponse;

    if (
      !response.ok ||
      !result.ok ||
      (result.status !== "settled" && result.status !== "already_settled")
    ) {
      throw new Error(result.error || "Settlement processing failed.");
    }

    repository.update(
      markSettlementSettled(
        processingRecord,
        result.transactionHash,
        new Date().toISOString()
      )
    );
    onRepositoryChange?.();
    onSettlementComplete?.();
  } catch (error) {
    repository.update(
      markSettlementFailed(
        processingRecord,
        error instanceof Error ? error.message : "Settlement processing failed.",
        new Date().toISOString()
      )
    );
    onRepositoryChange?.();
  }
}

export default function ScreenPage() {
  const auction = useDemoAuctionStore();
  const wallet = useWalletStore();
  const walletUsdcBalance = useWalletUsdcBalance();
  const escrowBalance = useWalletEscrowBalance();
  const reservedAmount = useTemporaryReservedAmount(wallet.address);
  const [bidErrors, setBidErrors] = useState<Record<number, string | null>>({});
  const [authorizingBidSlotIndex, setAuthorizingBidSlotIndex] =
    useState<number | null>(null);
  useSyncExternalStore(
    subscribeToSettlementRecordChanges,
    getSettlementRecordSnapshot,
    getSettlementRecordSnapshot
  );
  useSyncExternalStore(
    subscribeToEscrowSettlementReflection,
    getEscrowSettlementReflectionSnapshot,
    getEscrowSettlementReflectionSnapshot
  );
  const settlementRecords = listBrowserSettlementRecords();
  // Temporary demo model only. Until the Accounting Layer exists, available
  // auction capacity is escrow custody minus finalized winning reservations.
  const availableAuctionCapacity =
    escrowBalance.status === "ready" && escrowBalance.balance !== null
      ? Math.max(escrowBalance.balance - reservedAmount, 0)
      : 0;
  const phase = auction.clock.phase;
  const currentSlotIndex = auction.clock.currentSlotIndex;
  const displaySecondsRemaining =
    phase === "live"
      ? Math.max(
          AUCTION_TOTAL_CYCLE_SECONDS - auction.clock.elapsedInCycle,
          0
        )
      : auction.clock.secondsRemaining;
  const submittedBidsKey = auction.submittedBids.join("|");
  const liveWinner =
    phase === "live" ? auction.winners[currentSlotIndex] : null;
  const refreshWalletUsdcBalance = walletUsdcBalance.refresh;
  const refreshEscrowBalance = escrowBalance.refresh;
  const syncSettlementRecords = useCallback(() => {
    notifySettlementRecordsChanged();
  }, []);
  const clearBidError = useCallback((slotIndex: number) => {
    setBidErrors((currentBidErrors) => ({
      ...currentBidErrors,
      [slotIndex]: null,
    }));
  }, []);
  const handlePlaceBid = useCallback(
    async (slotIndex: number) => {
      if (authorizingBidSlotIndex !== null) {
        return;
      }

      if (!wallet.address) {
        setBidErrors((currentBidErrors) => ({
          ...currentBidErrors,
          [slotIndex]: "Connect your wallet before placing a bid.",
        }));
        return;
      }

      setAuthorizingBidSlotIndex(slotIndex);
      clearBidError(slotIndex);

      try {
        const result = await auction.placeBid(
          slotIndex,
          availableAuctionCapacity,
          wallet.address as `0x${string}`
        );

        if (!result.ok) {
          setBidErrors((currentBidErrors) => ({
            ...currentBidErrors,
            [slotIndex]: result.error,
          }));
        }
      } finally {
        setAuthorizingBidSlotIndex((currentSlotIndex) =>
          currentSlotIndex === slotIndex ? null : currentSlotIndex
        );
      }
    },
    [
      auction,
      authorizingBidSlotIndex,
      availableAuctionCapacity,
      clearBidError,
      wallet.address,
    ]
  );

  useEffect(() => {
    if (
      escrowBalance.status !== "ready" ||
      escrowBalance.balance === null ||
      !wallet.address
    ) {
      return;
    }

    syncEscrowCycleBaseline({
      cycleId: auction.clock.cycleId,
      advertiserAddress: wallet.address as `0x${string}`,
      escrowBalance: escrowBalance.balance,
    });
  }, [
    auction.clock.cycleId,
    escrowBalance.balance,
    escrowBalance.status,
    wallet.address,
  ]);

  const reflectedSettledAmount =
    escrowBalance.status === "ready"
      ? getReflectedSettledAmount({
          cycleId: auction.clock.cycleId,
          advertiserAddress: wallet.address as `0x${string}` | null,
          escrowBalance: escrowBalance.balance,
        })
      : 0;
  const confirmedBidExposure = getConfirmedBidExposure(
    auction.slotStates,
    auction.submittedBids
  );
  const displayedOpenBidExposure =
    auction.clock.phase === "open" ? confirmedBidExposure : 0;
  const displayedFinalizedReservedAmount =
    auction.clock.phase === "open"
      ? 0
      : deriveActiveSlotReservedAmount({
          cycleId: auction.clock.cycleId,
          advertiserAddress: wallet.address as `0x${string}` | null,
          slotIds: ACCOUNTING_SLOT_IDS,
          winnerBidAmounts: auction.winnerBidAmounts,
          winnerAdvertiserAddresses: auction.winnerAdvertiserAddresses,
          settlementRecords,
          reflectedSettledAmount,
        });
  const displayedReservedAmount =
    displayedFinalizedReservedAmount + displayedOpenBidExposure;
  const displayedAvailableAuctionCapacity =
    escrowBalance.status === "ready" && escrowBalance.balance !== null
      ? Math.max(escrowBalance.balance - displayedReservedAmount, 0)
      : 0;

  useEffect(() => {
    refreshWalletUsdcBalance();
    refreshEscrowBalance();
  }, [
    auction.clock.cycleId,
    auction.clock.phase,
    submittedBidsKey,
    refreshEscrowBalance,
    refreshWalletUsdcBalance,
  ]);

  useEffect(() => {
    if (!wallet.connected || !wallet.address) {
      return;
    }

    syncTemporaryAuctionReservations({
      advertiserAddress: wallet.address,
      clock: auction.clock,
      winners: auction.winners,
      winnerBidAmounts: auction.winnerBidAmounts,
    });
  }, [
    auction.clock,
    auction.winnerBidAmounts,
    auction.winners,
    wallet.address,
    wallet.connected,
  ]);

  useEffect(() => {
    const repository = createBrowserSettlementRepository();

    repository.listByStatus("failed").forEach((record) => {
      void processSettlementRecord(repository, record, syncSettlementRecords, () => {
        refreshWalletUsdcBalance();
        refreshEscrowBalance();
      });
    });
  }, [refreshEscrowBalance, refreshWalletUsdcBalance, syncSettlementRecords]);

  useEffect(() => {
    if (!auction.isLoaded || auction.clock.phase !== "live") {
      return;
    }

    const settlementEligibleSlotIds = getSettlementEligibleLiveSlotIds(
      auction.clock,
      ACCOUNTING_SLOT_IDS
    );

    if (settlementEligibleSlotIds.length === 0) {
      return;
    }

    let escrowAddress: `0x${string}`;

    try {
      escrowAddress = getArcEscrowAddress();
    } catch {
      return;
    }

    const records = createPendingSettlementRecords({
      snapshot: {
        phase: auction.clock.phase,
        cycleId: auction.clock.cycleId,
        chainId: ARC_CHAIN_ID,
        escrowAddress,
        treasuryAddress: ARC_TREASURY_ADDRESS,
        usdcAddress: ARC_USDC_CONTRACT_ADDRESS,
        slotIds: settlementEligibleSlotIds,
        winners: auction.winners,
        winnerBidAmounts: auction.winnerBidAmounts,
        winnerAdvertiserAddresses: auction.winnerAdvertiserAddresses,
        winnerBidAuthorizations: auction.winnerBidAuthorizations,
      },
      nowIso: new Date().toISOString(),
    });
    const repository = createBrowserSettlementRepository();

    records.forEach((record) => {
      if (repository.saveIfAbsent(record)) {
        syncSettlementRecords();
        void processSettlementRecord(repository, record, syncSettlementRecords, () => {
          refreshWalletUsdcBalance();
          refreshEscrowBalance();
        });
      }
    });
  }, [
    auction.clock,
    auction.clock.cycleId,
    auction.clock.elapsedInCycle,
    auction.clock.phase,
    auction.isLoaded,
    auction.winnerAdvertiserAddresses,
    auction.winnerBidAuthorizations,
    auction.winnerBidAmounts,
    auction.winners,
    refreshEscrowBalance,
    refreshWalletUsdcBalance,
    syncSettlementRecords,
  ]);

  if (!auction.isLoaded) {
    return (
      <main className="min-h-screen bg-neutral-950 px-6 py-10 text-white">
        <section className="mx-auto max-w-6xl">
          <p className="text-neutral-400">Loading auction...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <LiveScreen winner={liveWinner} />

        <AuctionArea
          phase={phase}
          secondsRemaining={displaySecondsRemaining}
          currentSlotIndex={currentSlotIndex}
          slots={[...auction.slots]}
          advertisements={auction.advertisements}
          slotStates={auction.slotStates}
          availableAuctionCapacity={availableAuctionCapacity}
          displayedAvailableAuctionCapacity={displayedAvailableAuctionCapacity}
          walletBalance={walletUsdcBalance.formattedBalance}
          walletBalanceStatus={walletUsdcBalance.status}
          walletBalanceError={walletUsdcBalance.error}
          escrowBalance={escrowBalance.balance}
          reservedAmount={displayedReservedAmount}
          escrowBalanceStatus={escrowBalance.status}
          escrowBalanceError={escrowBalance.error}
          submittedBids={auction.submittedBids}
          winners={auction.winners}
          bidErrors={bidErrors}
          authorizingBidSlotIndex={authorizingBidSlotIndex}
          isWalletConnected={wallet.connected}
          isWalletRestoring={wallet.status === "restoring"}
          onAdvertisementChange={(slot, value) => {
            clearBidError(slot);
            auction.updateSlot(slot, {
              selectedAdvertisement: value,
            });
          }}
          onBidChange={(slot, value) => {
            clearBidError(slot);
            auction.updateSlot(slot, {
              bid: value,
            });
          }}
          onPlaceBid={handlePlaceBid}
        />
      </section>
    </main>
  );
}
