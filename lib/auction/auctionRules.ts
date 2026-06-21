import type { AuctionAccess } from "./auctionTypes";

export function hasAuctionAccess(access: AuctionAccess) {
  return (
    access.hasWallet &&
    access.hasCompany &&
    access.hasAdvertisement &&
    access.balance > 0
  );
}

export function canPlaceBid(params: {
  access: AuctionAccess;
  phase: string;
  bidAmount: number;
}) {
  const { access, phase, bidAmount } = params;

  if (phase !== "open") {
    return false;
  }

  if (!hasAuctionAccess(access)) {
    return false;
  }

  if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
    return false;
  }

  if (bidAmount > access.balance) {
    return false;
  }

  return true;
}

export function getHighestBid<T extends { amount: number }>(bids: T[]) {
  if (bids.length === 0) {
    return null;
  }

  return bids.reduce((highestBid, bid) => {
    return bid.amount > highestBid.amount ? bid : highestBid;
  });
}