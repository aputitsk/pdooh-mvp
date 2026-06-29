import type { Advertisement } from "@/lib/auction";
import {
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

import AdvertisementSelect from "./AdvertisementSelect";
import HiddenBidInput from "./HiddenBidInput";

type AuctionSlotCardProps = {
  slotNumber: number;
  time: string;
  secondsRemaining: number;
  advertisements: Advertisement[];
  selectedAdvertisement: string;
  bid: string;
  availableAuctionCapacity?: UsdcMinorUnits;
  isAggregateExposureTooHigh?: boolean;
  isBidSubmitted?: boolean;
  isBidAuthorizing?: boolean;
  isDisabled?: boolean;
  disabledMessage?: string;
  bidError?: string | null;
  onAdvertisementChange: (value: string) => void;
  onBidChange: (value: string) => void;
  onPlaceBid: () => void | Promise<void>;
};

export default function AuctionSlotCard({
  slotNumber,
  secondsRemaining,
  advertisements,
  selectedAdvertisement,
  bid,
  availableAuctionCapacity = 0,
  isAggregateExposureTooHigh = false,
  isBidSubmitted = false,
  isBidAuthorizing = false,
  isDisabled = false,
  disabledMessage,
  bidError,
  onAdvertisementChange,
  onBidChange,
  onPlaceBid,
}: AuctionSlotCardProps) {
  const bidAmount = getBidAmount(bid);
  const hasSelectedAdvertisement = selectedAdvertisement.trim().length > 0;
  const hasBidAmount = bid.trim().length > 0 && bidAmount > 0;
  const isBidTooHigh =
    hasBidAmount && bidAmount > availableAuctionCapacity;
  const isLocked = isBidSubmitted || isDisabled || isBidAuthorizing;

  const canPlaceBid =
    hasSelectedAdvertisement &&
    hasBidAmount &&
    !isBidTooHigh &&
    !isAggregateExposureTooHigh &&
    !isLocked;

  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Slot {slotNumber}</h3>
          <p className="mt-1 text-xs font-semibold text-emerald-400">
            {secondsRemaining} sec remaining
          </p>
        </div>

        <span
          className={
            isBidSubmitted
              ? "rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400"
              : "rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400"
          }
        >
          {isBidSubmitted ? "Bid Submitted" : "OPEN"}
        </span>
      </div>

      <div className="space-y-5">
        {isDisabled && disabledMessage && (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm font-medium text-yellow-300">
            {disabledMessage}
          </div>
        )}

        <fieldset disabled={isLocked} className="space-y-5 disabled:opacity-60">
          <AdvertisementSelect
            advertisements={advertisements}
            value={selectedAdvertisement}
            onChange={onAdvertisementChange}
          />

          <HiddenBidInput value={bid} onChange={onBidChange} />
        </fieldset>

        {isBidTooHigh && !isDisabled && (
          <p className="text-sm text-red-400">
            Bid exceeds your available escrow balance.
          </p>
        )}

        {!isBidTooHigh && isAggregateExposureTooHigh && !isDisabled && (
          <p className="text-sm text-red-400">
            Total bids exceed available escrow capacity.
          </p>
        )}

        {bidError && !isBidSubmitted && (
          <p className="text-sm text-red-400">{bidError}</p>
        )}

        <button
          type="button"
          onClick={onPlaceBid}
          disabled={!canPlaceBid}
          className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40"
        >
          {isBidAuthorizing
            ? "Authorizing..."
            : isBidSubmitted
              ? "Bid Confirmed"
              : "Place Bid"}
        </button>
      </div>
    </div>
  );
}

function getBidAmount(bid: string): UsdcMinorUnits {
  try {
    return parseUSDCToMinorUnits(bid);
  } catch {
    return 0;
  }
}
