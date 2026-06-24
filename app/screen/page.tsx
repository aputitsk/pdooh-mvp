"use client";

import { useEffect } from "react";
import AuctionArea from "@/components/auction/AuctionArea";
import LiveScreen from "@/components/auction/LiveScreen";
import {
  syncTemporaryAuctionReservations,
  useDemoAuctionStore,
  useTemporaryReservedAmount,
} from "@/lib/auction";
import { useWalletEscrowBalance, useWalletStore } from "@/lib/wallet";

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
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-neutral-400">
            pDOOH Auction
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Live DOOH Screen
          </h1>

          <p className="mt-4 max-w-2xl text-neutral-400">
            Bid for private advertising slots. All bids are hidden. Only the
            winner is revealed.
          </p>
        </div>

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
            auction.placeBid(slot, availableAuctionCapacity)
          }
        />
      </section>
    </main>
  );
}
