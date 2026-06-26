import type { Advertisement, AuctionPhase, SlotState } from "@/lib/auction";
import { getTypedBidExposureThroughSlot } from "@/lib/auction";
import type { UsdcMinorUnits } from "@/lib/money/usdc";

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
  availableAuctionCapacity: UsdcMinorUnits;
  escrowBalance: UsdcMinorUnits | null;
  reservedAmount: UsdcMinorUnits;
  escrowBalanceStatus: "idle" | "loading" | "ready" | "error";
  escrowBalanceError: string | null;
  submittedBids: boolean[];
  winners: Advertisement[];
  isWalletConnected: boolean;
  isWalletRestoring?: boolean;
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
  availableAuctionCapacity,
  escrowBalance,
  reservedAmount,
  escrowBalanceStatus,
  escrowBalanceError,
  submittedBids,
  winners,
  isWalletConnected,
  isWalletRestoring = false,
  onAdvertisementChange,
  onBidChange,
  onPlaceBid,
}: AuctionAreaProps) {
  const hasAvailableAuctionCapacity =
    escrowBalanceStatus === "ready" && availableAuctionCapacity > 0;
  const isAuctionDisabled =
    !isWalletConnected || isWalletRestoring || !hasAvailableAuctionCapacity;
  const disabledMessage = isWalletRestoring
    ? undefined
    : !isWalletConnected
      ? "Connect your wallet to select advertisements and place bids."
      : escrowBalanceStatus === "loading"
        ? "Reading escrow capacity..."
        : escrowBalanceStatus === "error"
          ? escrowBalanceError ?? "Unable to read escrow capacity."
          : "Deposit USDC into escrow before placing bids.";

  return (
    <div>
      {phase === "open" && (
        <>
          <AuctionStatusCard
            phase={phase}
            secondsRemaining={secondsRemaining}
            currentSlotIndex={currentSlotIndex}
            escrowBalance={escrowBalance}
            availableAuctionCapacity={availableAuctionCapacity}
            reservedAmount={reservedAmount}
            escrowBalanceStatus={escrowBalanceStatus}
            escrowBalanceError={escrowBalanceError}
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
                availableAuctionCapacity={availableAuctionCapacity}
                isAggregateExposureTooHigh={
                  !submittedBids[index] &&
                  getTypedBidExposureThroughSlot(slotStates, index) >
                    availableAuctionCapacity
                }
                isBidSubmitted={submittedBids[index]}
                isDisabled={isAuctionDisabled}
                disabledMessage={disabledMessage}
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
            escrowBalance={escrowBalance}
            availableAuctionCapacity={availableAuctionCapacity}
            reservedAmount={reservedAmount}
            escrowBalanceStatus={escrowBalanceStatus}
            escrowBalanceError={escrowBalanceError}
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
          escrowBalance={escrowBalance}
          availableAuctionCapacity={availableAuctionCapacity}
          reservedAmount={reservedAmount}
          escrowBalanceStatus={escrowBalanceStatus}
          escrowBalanceError={escrowBalanceError}
          winners={winners}
        />
      )}
    </div>
  );
}