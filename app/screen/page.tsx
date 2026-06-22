"use client";

import AuctionArea from "@/components/auction/AuctionArea";
import LiveScreen from "@/components/auction/LiveScreen";
import { useDemoAuctionStore } from "@/lib/auction";
import { useWalletStore } from "@/lib/wallet";

export default function ScreenPage() {
  const auction = useDemoAuctionStore();
  const wallet = useWalletStore();

  const phase = auction.clock.phase;
  const currentSlotIndex = auction.clock.currentSlotIndex;
  const liveWinner =
    phase === "live" ? auction.winners[currentSlotIndex] : null;

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
          walletBalance={auction.walletBalance}
          submittedBids={auction.submittedBids}
          winners={auction.winners}
          isWalletConnected={wallet.connected}
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
          onPlaceBid={auction.placeBid}
        />
      </section>
    </main>
  );
}