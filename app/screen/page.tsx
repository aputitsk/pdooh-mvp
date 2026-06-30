"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import AuctionArea from "@/components/auction/AuctionArea";
import LiveScreen from "@/components/auction/LiveScreen";
import AppBackground from "@/components/layout/AppBackground";
import { createPendingSettlementRecords } from "@/lib/accounting/accountingFacade";
import {
  getUnresolvedSettlementReservedAmount,
  isRetryableFailedSettlementRecord,
  MISSING_BID_AUTHORIZATION_FAILURE_REASON,
  SETTLEMENT_WINDOW_CLOSED_FAILURE_REASON,
} from "@/lib/accounting/unresolvedSettlementReservedAmount";
import {
  getSettlementRecordSnapshot,
  listBrowserSettlementRecords,
  notifySettlementRecordsChanged,
  subscribeToSettlementRecordChanges,
} from "@/lib/accounting/settlementRecordSync";
import {
  markSettlementCancelled,
  markSettlementFailed,
  markSettlementAlreadySettled,
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
import type { UsdcMinorUnits } from "@/lib/money/usdc";

const ACCOUNTING_SLOT_IDS = ["slot-1", "slot-2", "slot-3"] as const;

type PendingSettledReservation = {
  settlementId: `0x${string}`;
  advertiserAddress: `0x${string}`;
  amount: UsdcMinorUnits;
  escrowBalanceBeforeSettlement: UsdcMinorUnits;
  createdAtMs: number;
};

const PENDING_SETTLED_RESERVATION_TTL_MS = 2 * 60 * 1000;

type OperatorProcessResponse = {
  ok: boolean;
  code?: string;
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
    failureReason: MISSING_BID_AUTHORIZATION_FAILURE_REASON,
  };
}

function addSafeMinorUnits(
  current: UsdcMinorUnits,
  amount: UsdcMinorUnits
): UsdcMinorUnits {
  const next = current + amount;
  return Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
}

function toSafeMinorUnits(value: bigint): UsdcMinorUnits | null {
  if (value <= BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return Number(value);
}

function prunePendingSettledReservations(params: {
  reservations: Record<string, PendingSettledReservation>;
  escrowBalance: UsdcMinorUnits | null;
  nowMs: number;
}) {
  const { reservations, escrowBalance, nowMs } = params;
  const activeReservations = Object.values(reservations).filter(
    (reservation) =>
      nowMs - reservation.createdAtMs < PENDING_SETTLED_RESERVATION_TTL_MS
  );
  const reflectedSettlementIds = new Set<string>();

  if (escrowBalance !== null) {
    const reservationsByBaseline = new Map<
      UsdcMinorUnits,
      PendingSettledReservation[]
    >();

    activeReservations.forEach((reservation) => {
      const baselineReservations =
        reservationsByBaseline.get(reservation.escrowBalanceBeforeSettlement) ??
        [];

      baselineReservations.push(reservation);
      reservationsByBaseline.set(
        reservation.escrowBalanceBeforeSettlement,
        baselineReservations
      );
    });

    reservationsByBaseline.forEach((baselineReservations, baseline) => {
      const totalBaselineAmount = baselineReservations.reduce<UsdcMinorUnits>(
        (total, reservation) => addSafeMinorUnits(total, reservation.amount),
        0
      );

      if (escrowBalance <= baseline - totalBaselineAmount) {
        baselineReservations.forEach((reservation) => {
          reflectedSettlementIds.add(reservation.settlementId);
        });
      }
    });
  }

  const nextReservations = activeReservations.reduce<
    Record<string, PendingSettledReservation>
  >((next, reservation) => {
    if (!reflectedSettlementIds.has(reservation.settlementId)) {
      next[reservation.settlementId] = reservation;
    }

    return next;
  }, {});

  return Object.keys(nextReservations).length === Object.keys(reservations).length
    ? reservations
    : nextReservations;
}

async function processSettlementRecord(
  repository: SettlementRepository,
  record: SettlementRecord,
  onRepositoryChange?: () => void,
  onSettlementComplete?: (settledRecord?: SettlementRecord) => void
) {
  if (record.status !== "pending" && record.status !== "failed") {
    return;
  }

  if (
    record.status === "failed" &&
    !isRetryableFailedSettlementRecord(record)
  ) {
    return;
  }

  if (!record.result.bidAuthorization) {
    repository.update(markMissingBidAuthorization(record));
    onRepositoryChange?.();
    return;
  }

  const latestRecord = repository.getById(record.settlementId);

  if (
    latestRecord?.status === "settled" ||
    latestRecord?.status === "already_settled" ||
    latestRecord?.status === "cancelled" ||
    latestRecord?.status === "processing"
  ) {
    return;
  }

  const processingRecord = markSettlementProcessing(
    latestRecord ?? record,
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
      if (result.code === "SETTLEMENT_WINDOW_NOT_OPEN") {
        repository.update(
          markSettlementCancelled(
            processingRecord,
            SETTLEMENT_WINDOW_CLOSED_FAILURE_REASON,
            new Date().toISOString()
          )
        );
        onRepositoryChange?.();
        return;
      }

      throw new Error(result.error || "Settlement processing failed.");
    }

    let completedRecord: SettlementRecord | undefined;

    if (result.status === "already_settled" && !result.transactionHash) {
      const currentRecord = repository.getById(processingRecord.settlementId);

      if (currentRecord?.status !== "settled" || !currentRecord.txHash) {
        repository.update(
          markSettlementAlreadySettled(
            processingRecord,
            new Date().toISOString()
          )
        );
      }
    } else if (result.transactionHash) {
      completedRecord = markSettlementSettled(
        processingRecord,
        result.transactionHash,
        new Date().toISOString()
      );
      repository.update(completedRecord);
    } else {
      throw new Error("Settlement transaction hash is missing.");
    }

    onSettlementComplete?.(completedRecord);
    onRepositoryChange?.();
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
  const temporaryReservedAmount = useTemporaryReservedAmount(wallet.address);
  const [pendingSettledReservations, setPendingSettledReservations] = useState<
    Record<string, PendingSettledReservation>
  >({});
  const [bidErrors, setBidErrors] = useState<Record<number, string | null>>({});
  const [authorizingBidSlotIndex, setAuthorizingBidSlotIndex] =
    useState<number | null>(null);
  const settlementRecordVersion = useSyncExternalStore(
    subscribeToSettlementRecordChanges,
    getSettlementRecordSnapshot,
    getSettlementRecordSnapshot
  );
  const settlementRecords = listBrowserSettlementRecords();
  const unresolvedSettlementReservedAmount =
    getUnresolvedSettlementReservedAmount(settlementRecords, wallet.address);
  const pendingSettledReservedAmount = Object.values(
    pendingSettledReservations
  ).reduce<UsdcMinorUnits>(
    (total, reservation) => addSafeMinorUnits(total, reservation.amount),
    0
  );
  const reservedAmount = Math.min(
    temporaryReservedAmount +
      unresolvedSettlementReservedAmount +
      pendingSettledReservedAmount,
    Number.MAX_SAFE_INTEGER
  );
  const displayedReservedAmount = reservedAmount;
  const availableAuctionCapacity =
    escrowBalance.status === "ready" && escrowBalance.balance !== null
      ? Math.max(escrowBalance.balance - displayedReservedAmount, 0)
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
  const trackSettledPendingReflection = useCallback(
    (settledRecord: SettlementRecord | undefined) => {
      if (
        !settledRecord ||
        escrowBalance.status !== "ready" ||
        escrowBalance.balance === null ||
        !wallet.address ||
        settledRecord.result.advertiserAddress.toLowerCase() !==
          wallet.address.toLowerCase()
      ) {
        return;
      }

      const amount = toSafeMinorUnits(settledRecord.result.amountMinorUnits);

      if (amount === null) {
        return;
      }

      const escrowBalanceBeforeSettlement = escrowBalance.balance;

      setPendingSettledReservations((currentReservations) => {
        if (currentReservations[settledRecord.settlementId]) {
          return currentReservations;
        }

        return {
          ...currentReservations,
          [settledRecord.settlementId]: {
            settlementId: settledRecord.settlementId,
            advertiserAddress: settledRecord.result.advertiserAddress,
            amount,
            escrowBalanceBeforeSettlement,
            createdAtMs: Date.now(),
          },
        };
      });
    },
    [escrowBalance.balance, escrowBalance.status, wallet.address]
  );
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
    refreshWalletUsdcBalance();
    refreshEscrowBalance();
  }, [
    auction.clock.cycleId,
    auction.clock.phase,
    settlementRecordVersion,
    submittedBidsKey,
    refreshEscrowBalance,
    refreshWalletUsdcBalance,
  ]);

  useEffect(() => {
    if (Object.keys(pendingSettledReservations).length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPendingSettledReservations((currentReservations) =>
        prunePendingSettledReservations({
          reservations: currentReservations,
          escrowBalance:
            escrowBalance.status === "ready" ? escrowBalance.balance : null,
          nowMs: Date.now(),
        })
      );
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    escrowBalance.balance,
    escrowBalance.status,
    pendingSettledReservations,
  ]);

  useEffect(() => {
    const reservations = Object.values(pendingSettledReservations);

    if (reservations.length === 0) {
      return;
    }

    const nextExpiryDelayMs = Math.max(
      Math.min(
        ...reservations.map(
          (reservation) =>
            reservation.createdAtMs +
            PENDING_SETTLED_RESERVATION_TTL_MS -
            Date.now()
        )
      ),
      0
    );
    const timeoutId = window.setTimeout(() => {
      setPendingSettledReservations((currentReservations) =>
        prunePendingSettledReservations({
          reservations: currentReservations,
          escrowBalance:
            escrowBalance.status === "ready" ? escrowBalance.balance : null,
          nowMs: Date.now(),
        })
      );
    }, nextExpiryDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    escrowBalance.balance,
    escrowBalance.status,
    pendingSettledReservations,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPendingSettledReservations({});
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [wallet.address]);

  useEffect(() => {
    if (!wallet.connected) {
      return;
    }

    syncTemporaryAuctionReservations({
      clock: auction.clock,
      slotStates: auction.slotStates,
      submittedBids: auction.submittedBids,
      winners: auction.winners,
      winnerBidAmounts: auction.winnerBidAmounts,
      winnerAdvertiserAddresses: auction.winnerAdvertiserAddresses,
    });
  }, [
    auction.clock,
    auction.slotStates,
    auction.submittedBids,
    auction.winnerAdvertiserAddresses,
    auction.winnerBidAmounts,
    auction.winners,
    settlementRecordVersion,
    wallet.connected,
  ]);

  useEffect(() => {
    const repository = createBrowserSettlementRepository();

    repository.listByStatus("failed").forEach((record) => {
      void processSettlementRecord(
        repository,
        record,
        syncSettlementRecords,
        (settledRecord) => {
          trackSettledPendingReflection(settledRecord);
          refreshWalletUsdcBalance();
          refreshEscrowBalance();
        }
      );
    });
  }, [
    refreshEscrowBalance,
    refreshWalletUsdcBalance,
    syncSettlementRecords,
    trackSettledPendingReflection,
  ]);

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
        void processSettlementRecord(
          repository,
          record,
          syncSettlementRecords,
          (settledRecord) => {
            trackSettledPendingReflection(settledRecord);
            refreshWalletUsdcBalance();
            refreshEscrowBalance();
          }
        );
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
    trackSettledPendingReflection,
  ]);

  if (!auction.isLoaded) {
    return (
      <AppBackground className="px-6 py-10">
        <section className="mx-auto max-w-6xl">
          <p className="text-neutral-400">Loading auction...</p>
        </section>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="px-6 py-10">
      <section className="mx-auto max-w-6xl">
        <LiveScreen winner={liveWinner} />

        <AuctionArea
          phase={phase}
          secondsRemaining={displaySecondsRemaining}
          slotSecondsRemaining={auction.clock.secondsRemaining}
          currentSlotIndex={currentSlotIndex}
          slots={[...auction.slots]}
          advertisements={auction.advertisements}
          slotStates={auction.slotStates}
          availableAuctionCapacity={availableAuctionCapacity}
          displayedAvailableAuctionCapacity={availableAuctionCapacity}
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
    </AppBackground>
  );
}
