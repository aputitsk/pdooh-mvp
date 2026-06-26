"use client";

import { useEffect } from "react";
import AuctionArea from "@/components/auction/AuctionArea";
import LiveScreen from "@/components/auction/LiveScreen";
import { createPendingSettlementRecords } from "@/lib/accounting/accountingFacade";
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
import { ARC_CHAIN_ID } from "@/lib/arc/arcConstants";
import { getArcEscrowAddress } from "@/lib/arc/arcEscrowConfig";
import {
  syncTemporaryAuctionReservations,
  useDemoAuctionStore,
  useTemporaryReservedAmount,
} from "@/lib/auction";
import { useWalletEscrowBalance, useWalletStore } from "@/lib/wallet";

const ACCOUNTING_SLOT_IDS = ["slot-1", "slot-2", "slot-3"] as const;

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

async function processSettlementRecord(
  repository: SettlementRepository,
  record: SettlementRecord
) {
  if (record.status !== "pending" && record.status !== "failed") {
    return;
  }

  const processingRecord = markSettlementProcessing(
    record,
    new Date().toISOString()
  );
  repository.update(processingRecord);

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
  } catch (error) {
    repository.update(
      markSettlementFailed(
        processingRecord,
        error instanceof Error ? error.message : "Settlement processing failed.",
        new Date().toISOString()
      )
    );
  }
}

export default function ScreenPage() {
  const auction = useDemoAuctionStore();
  const wallet = useWalletStore();
  const escrowBalance = useWalletEscrowBalance();
  const reservedAmount = useTemporaryReservedAmount(wallet.address);
  // Temporary demo model only. Until the Accounting Layer exists, available
  // auction capacity is escrow custody minus finalized winning reservations.
  const availableAuctionCapacity =
    escrowBalance.status === "ready" && escrowBalance.balance !== null
      ? Math.max(escrowBalance.balance - reservedAmount, 0)
      : 0;

  const phase = auction.clock.phase;
  const currentSlotIndex = auction.clock.currentSlotIndex;
  const liveWinner =
    phase === "live" ? auction.winners[currentSlotIndex] : null;

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
      void processSettlementRecord(repository, record);
    });
  }, []);

  useEffect(() => {
    if (
      !auction.isLoaded ||
      (auction.clock.phase !== "locked" && auction.clock.phase !== "live")
    ) {
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
        slotIds: ACCOUNTING_SLOT_IDS,
        winners: auction.winners,
        winnerBidAmounts: auction.winnerBidAmounts,
        winnerAdvertiserAddresses: auction.winnerAdvertiserAddresses,
      },
      nowIso: new Date().toISOString(),
    });
    const repository = createBrowserSettlementRepository();

    records.forEach((record) => {
      if (repository.saveIfAbsent(record)) {
        void processSettlementRecord(repository, record);
      }
    });
  }, [
    auction.clock.cycleId,
    auction.clock.phase,
    auction.isLoaded,
    auction.winnerAdvertiserAddresses,
    auction.winnerBidAmounts,
    auction.winners,
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
          secondsRemaining={auction.clock.secondsRemaining}
          currentSlotIndex={currentSlotIndex}
          slots={[...auction.slots]}
          advertisements={auction.advertisements}
          slotStates={auction.slotStates}
          availableAuctionCapacity={availableAuctionCapacity}
          escrowBalance={escrowBalance.balance}
          reservedAmount={reservedAmount}
          escrowBalanceStatus={escrowBalance.status}
          escrowBalanceError={escrowBalance.error}
          submittedBids={auction.submittedBids}
          winners={auction.winners}
          isWalletConnected={wallet.connected}
          isWalletRestoring={wallet.status === "restoring"}
          onAdvertisementChange={(slot, value) =>
            auction.updateSlot(slot, {
              selectedAdvertisement: value,
            })
          }
          onBidChange={(slot, value) =>
            auction.updateSlot(slot, {
              bid: value,
            })
          }
          onPlaceBid={(slot) =>
            wallet.address &&
            auction.placeBid(
              slot,
              availableAuctionCapacity,
              wallet.address as `0x${string}`
            )
          }
        />
      </section>
    </main>
  );
}