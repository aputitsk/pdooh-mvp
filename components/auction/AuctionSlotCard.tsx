import type { Advertisement } from "@/lib/auction";
import {
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

import AdvertisementSelect from "./AdvertisementSelect";
import HiddenBidInput from "./HiddenBidInput";
import type { MarketTheme } from "./marketTheme";
import styles from "./AuctionSlotCard.module.css";

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
  isBidJustSubmitted?: boolean;
  isBidAuthorizing?: boolean;
  isDisabled?: boolean;
  disabledMessage?: string;
  bidError?: string | null;
  marketTheme: MarketTheme;
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
  isBidJustSubmitted = false,
  isBidAuthorizing = false,
  isDisabled = false,
  disabledMessage,
  bidError,
  marketTheme,
  onAdvertisementChange,
  onBidChange,
  onPlaceBid,
}: AuctionSlotCardProps) {
  const bidAmount = getBidAmount(bid);
  const hasSelectedAdvertisement = selectedAdvertisement.trim().length > 0;
  const hasBidAmount = bid.trim().length > 0 && bidAmount > 0;
  const isBidTooHigh = hasBidAmount && bidAmount > availableAuctionCapacity;
  const isLocked = isBidSubmitted || isDisabled || isBidAuthorizing;
  const isOpen = !isBidSubmitted && !isDisabled && !isBidAuthorizing;

  const canPlaceBid =
    hasSelectedAdvertisement &&
    hasBidAmount &&
    !isBidTooHigh &&
    !isAggregateExposureTooHigh &&
    !isLocked;
  const statusLabel = isBidAuthorizing
    ? "Authorizing"
    : isBidSubmitted
      ? "Bid Confirmed"
      : isDisabled
        ? "Unavailable"
        : "Open";
  const cardStateClassName = isBidSubmitted
    ? marketTheme.slot.cardSubmittedClassName
    : isBidAuthorizing
      ? marketTheme.slot.cardAuthorizingClassName
      : marketTheme.slot.cardDefaultClassName;
  const accentClassName = isBidSubmitted
    ? marketTheme.slot.accentSubmittedClassName
    : isBidAuthorizing
      ? marketTheme.slot.accentAuthorizingClassName
      : isDisabled
        ? "from-white/20 via-white/10 to-transparent"
        : marketTheme.slot.accentDefaultClassName;
  const statusClassName = isBidSubmitted
    ? marketTheme.slot.statusSubmittedClassName
    : isBidAuthorizing
      ? marketTheme.slot.statusAuthorizingClassName
      : isDisabled
        ? "border-white/10 bg-white/[0.03] text-white/45"
        : "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100";
  const actionClassName = canPlaceBid
    ? `${marketTheme.slot.actionReadyClassName} ${marketTheme.slot.actionFocusClassName}`
    : "border-white/10 bg-white/[0.06] text-white/40";

  return (
    <div
      className={`auction-landscape-slot-card relative overflow-hidden rounded-lg border p-5 transition duration-200 ${marketTheme.slot.cardBackgroundClassName} ${cardStateClassName}`}
    >
      <div
        className={`absolute left-0 top-0 h-px w-full bg-gradient-to-r ${accentClassName}`}
      />

      <div className="auction-landscape-slot-header relative mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-normal text-[#CFE8FF]">
            Slot {slotNumber}
          </h3>
          <p className="mt-2 inline-flex whitespace-nowrap rounded-md border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-semibold text-white/60">
            <span className="font-mono tabular-nums">{secondsRemaining}</span>
            <span>&nbsp;sec remaining</span>
          </p>
        </div>

        <span
          className={`shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest ${statusClassName} ${
            isOpen ? styles.openStatus : ""
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="relative space-y-4">
        {isDisabled && disabledMessage && (
          <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2.5 text-sm font-medium text-amber-100/80">
            {disabledMessage}
          </div>
        )}

        <fieldset
          disabled={isLocked}
          className="auction-landscape-slot-fieldset space-y-4 border-t border-white/10 pt-5 disabled:opacity-60"
        >
          <AdvertisementSelect
            advertisements={advertisements}
            value={selectedAdvertisement}
            onChange={onAdvertisementChange}
            controlClassName={marketTheme.slot.controlClassName}
          />

          <HiddenBidInput
            value={bid}
            onChange={onBidChange}
            controlWrapperClassName={marketTheme.slot.controlWrapperClassName}
          />
        </fieldset>

        {isBidTooHigh && !isDisabled && (
          <p className="rounded-lg border border-red-300/20 bg-red-400/[0.08] px-3 py-2.5 text-sm font-medium text-red-200">
            Bid exceeds your available escrow balance.
          </p>
        )}

        {!isBidTooHigh && isAggregateExposureTooHigh && !isDisabled && (
          <p className="rounded-lg border border-red-300/20 bg-red-400/[0.08] px-3 py-2.5 text-sm font-medium text-red-200">
            Total bids exceed available escrow capacity.
          </p>
        )}

        {bidError && !isBidSubmitted && (
          <p className="rounded-lg border border-red-300/20 bg-red-400/[0.08] px-3 py-2.5 text-sm font-medium text-red-200">
            {bidError}
          </p>
        )}

        {isBidJustSubmitted && (
          <p className="rounded-lg border border-cyan-200/20 bg-cyan-200/[0.07] px-3 py-2.5 text-sm font-semibold text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.08)]">
            Bid submitted
          </p>
        )}

        <button
          type="button"
          onClick={onPlaceBid}
          disabled={!canPlaceBid}
          className={`w-full rounded-lg border px-4 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${actionClassName}`}
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
