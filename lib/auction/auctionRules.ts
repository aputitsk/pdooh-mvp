import type { AuctionAccess, SlotState } from "./auctionTypes";
import type { UsdcMinorUnits } from "@/lib/money/usdc";
import { parseUSDCToMinorUnits } from "@/lib/money/usdc";

export function hasAuctionAccess(access: AuctionAccess) {
  return (
    access.hasWallet &&
    access.hasBusinessProfile &&
    access.hasAdvertisement &&
    access.balance > 0
  );
}

export function canPlaceBid(params: {
  access: AuctionAccess;
  phase: string;
  bidAmount: UsdcMinorUnits;
}) {
  const { access, phase, bidAmount } = params;

  if (phase !== "open") {
    return false;
  }

  if (!hasAuctionAccess(access)) {
    return false;
  }

  if (!Number.isSafeInteger(bidAmount) || bidAmount <= 0) {
    return false;
  }

  if (bidAmount > access.balance) {
    return false;
  }

  return true;
}

export function getHighestBid<T extends { amount: UsdcMinorUnits }>(bids: T[]) {
  if (bids.length === 0) {
    return null;
  }

  return bids.reduce((highestBid, bid) => {
    return bid.amount > highestBid.amount ? bid : highestBid;
  });
}

export function getUserBidExposure(
  slotStates: SlotState[]
): UsdcMinorUnits {
  return slotStates.reduce<UsdcMinorUnits>((totalExposure, slotState) => {
    return totalExposure + getSlotBidAmount(slotState.bid);
  }, 0);
}

function getSlotBidAmount(bid: string): UsdcMinorUnits {
  if (!bid) {
    return 0;
  }

  try {
    return parseUSDCToMinorUnits(bid);
  } catch {
    return 0;
  }
}
