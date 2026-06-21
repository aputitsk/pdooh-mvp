import type { Advertisement, AuctionPhase, SlotState } from "@/lib/auction";

import AuctionStatusCard from "./AuctionStatusCard";
import AuctionSlotCard from "./AuctionSlotCard";
import DemoModeCard from "./DemoModeCard";

type AuctionAreaProps = {
  phase: AuctionPhase;
  secondsRemaining: number;
  currentSlotIndex: number;
  slots: string[];
  advertisements: Advertisement[];
  slotStates: SlotState[];
  walletBalance: number;
  submittedBids: boolean[];
  winners: Advertisement[];
  onAdvertisementChange: (slotIndex: number, value: string) => void;
  onBidChange: (slotIndex: number, value: string) => void;
  onPlaceBid: (slotIndex: number) => void;
};

export default function AuctionArea({
  phase,
  secondsRemaining,
  currentSlotIndex,
  slots,
  advertisements,
  slotStates,
  walletBalance,
  submittedBids,
  winners,
  onAdvertisementChange,
  onBidChange,
  onPlaceBid,
}: AuctionAreaProps) {
  return (
    <div>
      {phase === "open" && (
        <>
          <div className="mb-5">
            <h2 className="text-2xl font-semibold">Available Time Slots</h2>

            <p className="mt-2 text-sm text-neutral-400">
              Choose a slot, select an advertisement, and place a hidden bid.
            </p>
          </div>

          <AuctionStatusCard
            phase={phase}
            secondsRemaining={secondsRemaining}
            currentSlotIndex={currentSlotIndex}
            walletBalance={walletBalance}
            winners={winners}
          />

          <div className="grid gap-5 md:grid-cols-3">
            {slots.map((time, index) => (
              <AuctionSlotCard
                key={time}
                slotNumber={index + 1}
                time={time}
                advertisements={advertisements}
                selectedAdvertisement={slotStates[index].selectedAdvertisement}
                bid={slotStates[index].bid}
                walletBalance={walletBalance}
                isBidSubmitted={submittedBids[index]}
                onAdvertisementChange={(value) =>
                  onAdvertisementChange(index, value)
                }
                onBidChange={(value) => onBidChange(index, value)}
                onPlaceBid={() => onPlaceBid(index)}
              />
            ))}
          </div>

          <div className="mt-6">
            <DemoModeCard />
          </div>
        </>
      )}

      {phase === "locked" && (
        <>
          <AuctionStatusCard
            phase={phase}
            secondsRemaining={secondsRemaining}
            currentSlotIndex={currentSlotIndex}
            walletBalance={walletBalance}
            winners={winners}
          />

          <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
            <p className="text-sm font-medium text-neutral-400">
              Auction is closed
            </p>

            <p className="mt-2 text-neutral-500">
              Hidden bids are locked. Winners and advertisements are revealed.
            </p>
          </div>

          <div className="mt-6">
            <DemoModeCard />
          </div>
        </>
      )}

      {phase === "live" && (
        <AuctionStatusCard
          phase={phase}
          secondsRemaining={secondsRemaining}
          currentSlotIndex={currentSlotIndex}
          walletBalance={walletBalance}
          winners={winners}
        />
      )}
    </div>
  );
}