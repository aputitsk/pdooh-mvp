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
  advertisements: Advertisement[];
  selectedAdvertisement: string;
  bid: string;
  walletBalance?: UsdcMinorUnits;
  isBidSubmitted?: boolean;
  isDisabled?: boolean;
  disabledMessage?: string;
  onAdvertisementChange: (value: string) => void;
  onBidChange: (value: string) => void;
  onPlaceBid: () => void;
};

export default function AuctionSlotCard({
  slotNumber,
  advertisements,
  selectedAdvertisement,
  bid,
  walletBalance = 0,
  isBidSubmitted = false,
  isDisabled = false,
  disabledMessage,
  onAdvertisementChange,
  onBidChange,
  onPlaceBid,
}: AuctionSlotCardProps) {
  const bidAmount = getBidAmount(bid);
  const hasSelectedAdvertisement = selectedAdvertisement.trim().length > 0;
  const hasBidAmount = bid.trim().length > 0 && bidAmount > 0;
  const isBidTooHigh = hasBidAmount && bidAmount > walletBalance;
  const isLocked = isBidSubmitted || isDisabled;

  const canPlaceBid =
    hasSelectedAdvertisement &&
    hasBidAmount &&
    !isBidTooHigh &&
    !isLocked;

  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="mb-5 flex items-start justify-between">
        <h3 className="text-lg font-semibold">Slot {slotNumber}</h3>

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
            Bid exceeds your Internal Wallet balance.
          </p>
        )}

        {isBidSubmitted && (
          <p className="text-sm text-blue-400">
            Hidden bid confirmed for this slot.
          </p>
        )}

        <button
          type="button"
          onClick={onPlaceBid}
          disabled={!canPlaceBid}
          className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40"
        >
          {isBidSubmitted ? "Bid Confirmed" : "Place Hidden Bid"}
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
