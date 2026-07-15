import type { Advertisement, AuctionPhase, SlotState } from "@/lib/auction";
import { getTypedBidExposureThroughSlot } from "@/lib/auction";
import type { UsdcMinorUnits } from "@/lib/money/usdc";

import AuctionStatusCard from "./AuctionStatusCard";
import AuctionSlotCard from "./AuctionSlotCard";
import DemoModeCard from "./DemoModeCard";
import type { MarketTheme } from "./marketTheme";

type AuctionAreaProps = {
  phase: AuctionPhase;
  secondsRemaining: number;
  slotSecondsRemaining: number;
  currentSlotIndex: number;
  slots: string[];
  advertisements: Advertisement[];
  slotStates: SlotState[];
  availableAuctionCapacity: UsdcMinorUnits;
  displayedAvailableAuctionCapacity: UsdcMinorUnits;
  walletBalance: string;
  walletBalanceMinorUnits: UsdcMinorUnits | null;
  walletBalanceStatus: "idle" | "loading" | "ready" | "error";
  walletBalanceError: string | null;
  escrowBalance: UsdcMinorUnits | null;
  reservedAmount: UsdcMinorUnits;
  escrowBalanceStatus: "idle" | "loading" | "ready" | "error";
  escrowBalanceError: string | null;
  submittedBids: boolean[];
  winners: Advertisement[];
  bidErrors?: Record<number, string | null>;
  authorizingBidSlotIndex?: number | null;
  recentSubmittedBidSlotIndex?: number | null;
  isWalletConnected: boolean;
  isWalletRestoring?: boolean;
  marketTheme: MarketTheme;
  onRetryWalletBalance: () => void;
  onRetryEscrowBalance: () => void;
  onAdvertisementChange: (slotIndex: number, value: string) => void;
  onBidChange: (slotIndex: number, value: string) => void;
  onPlaceBid: (slotIndex: number) => void | Promise<void>;
};

export default function AuctionArea({
  phase,
  secondsRemaining,
  slotSecondsRemaining,
  currentSlotIndex,
  slots,
  advertisements,
  slotStates,
  availableAuctionCapacity,
  displayedAvailableAuctionCapacity,
  walletBalance,
  walletBalanceMinorUnits,
  walletBalanceStatus,
  walletBalanceError,
  escrowBalance,
  reservedAmount,
  escrowBalanceStatus,
  escrowBalanceError,
  submittedBids,
  winners,
  bidErrors = {},
  authorizingBidSlotIndex = null,
  recentSubmittedBidSlotIndex = null,
  isWalletConnected,
  isWalletRestoring = false,
  marketTheme,
  onRetryWalletBalance,
  onRetryEscrowBalance,
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
      ? "Log in to select advertisements and place bids."
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
            slotSecondsRemaining={slotSecondsRemaining}
            currentSlotIndex={currentSlotIndex}
            walletBalance={walletBalance}
            walletBalanceMinorUnits={walletBalanceMinorUnits}
            walletBalanceStatus={walletBalanceStatus}
            walletBalanceError={walletBalanceError}
            escrowBalance={escrowBalance}
            availableAuctionCapacity={displayedAvailableAuctionCapacity}
            reservedAmount={reservedAmount}
            escrowBalanceStatus={escrowBalanceStatus}
            escrowBalanceError={escrowBalanceError}
            winners={winners}
            onRetryWalletBalance={onRetryWalletBalance}
            onRetryEscrowBalance={onRetryEscrowBalance}
          />

          <div className="auction-landscape-slot-grid grid gap-5 md:grid-cols-3">
            {slots.map((time, index) => (
              <AuctionSlotCard
                key={time}
                slotNumber={index + 1}
                time={time}
                secondsRemaining={secondsRemaining}
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
                isBidJustSubmitted={recentSubmittedBidSlotIndex === index}
                isBidAuthorizing={authorizingBidSlotIndex === index}
                isDisabled={isAuctionDisabled}
                disabledMessage={disabledMessage}
                bidError={bidErrors[index] ?? null}
                marketTheme={marketTheme}
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
        <AuctionStatusCard
          phase={phase}
          slotSecondsRemaining={slotSecondsRemaining}
          currentSlotIndex={currentSlotIndex}
          walletBalance={walletBalance}
          walletBalanceMinorUnits={walletBalanceMinorUnits}
          walletBalanceStatus={walletBalanceStatus}
          walletBalanceError={walletBalanceError}
          escrowBalance={escrowBalance}
          availableAuctionCapacity={displayedAvailableAuctionCapacity}
          reservedAmount={reservedAmount}
          escrowBalanceStatus={escrowBalanceStatus}
          escrowBalanceError={escrowBalanceError}
          winners={winners}
          onRetryWalletBalance={onRetryWalletBalance}
          onRetryEscrowBalance={onRetryEscrowBalance}
        />
      )}

      {phase === "live" && (
        <AuctionStatusCard
          phase={phase}
          slotSecondsRemaining={slotSecondsRemaining}
          currentSlotIndex={currentSlotIndex}
          walletBalance={walletBalance}
          walletBalanceMinorUnits={walletBalanceMinorUnits}
          walletBalanceStatus={walletBalanceStatus}
          walletBalanceError={walletBalanceError}
          escrowBalance={escrowBalance}
          availableAuctionCapacity={displayedAvailableAuctionCapacity}
          reservedAmount={reservedAmount}
          escrowBalanceStatus={escrowBalanceStatus}
          escrowBalanceError={escrowBalanceError}
          winners={winners}
          onRetryWalletBalance={onRetryWalletBalance}
          onRetryEscrowBalance={onRetryEscrowBalance}
        />
      )}
    </div>
  );
}
