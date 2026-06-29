import type {
  Advertisement,
  SignedBidAuthorization,
  SlotState,
} from "./auctionTypes";
import { DEMO_BOT_ADVERTISEMENT, DEMO_BOT_BID } from "./constants";
import {
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

export type AuctionWinnersResult = {
  winners: Advertisement[];
  winnerBidAmounts: UsdcMinorUnits[];
  winnerAdvertiserAddresses: (`0x${string}` | null)[];
  winnerBidAuthorizations: (SignedBidAuthorization | null)[];
};

export function selectAuctionWinners(params: {
  slotStates: SlotState[];
  submittedBids: boolean[];
  advertisements: Advertisement[];
}): AuctionWinnersResult {
  const { slotStates, submittedBids, advertisements } = params;

  const winners = slotStates.map((slot, index) => {
    const userBid = getWinningBidAmount(slot);

    const advertisement = advertisements.find(
      (item) => item.name === slot.selectedAdvertisement
    );

    if (!submittedBids[index] || !userBid || userBid <= DEMO_BOT_BID) {
      return DEMO_BOT_ADVERTISEMENT;
    }

    if (!slot.bidAuthorization && !advertisement) {
      return DEMO_BOT_ADVERTISEMENT;
    }

    if (slot.bidAuthorization) {
      return {
        name: slot.bidAuthorization.payload.advertisementName,
        businessName: slot.bidAuthorization.payload.businessName,
      };
    }

    return advertisement ?? DEMO_BOT_ADVERTISEMENT;
  });

  const winnerBidAmounts = slotStates.map((slot, index) => {
    const userBid = getWinningBidAmount(slot);
    const winner = winners[index];

    if (winner.businessName === DEMO_BOT_ADVERTISEMENT.businessName) {
      return 0;
    }

    return userBid;
  });
  const winnerAdvertiserAddresses = slotStates.map((slot, index) => {
    const winner = winners[index];

    if (winner.businessName === DEMO_BOT_ADVERTISEMENT.businessName) {
      return null;
    }

    return (
      slot.bidAuthorization?.payload.advertiserAddress ??
      slot.advertiserAddress ??
      null
    );
  });
  const winnerBidAuthorizations = slotStates.map((slot, index) => {
    const winner = winners[index];

    if (winner.businessName === DEMO_BOT_ADVERTISEMENT.businessName) {
      return null;
    }

    return slot.bidAuthorization ?? null;
  });

  return {
    winners,
    winnerBidAmounts,
    winnerAdvertiserAddresses,
    winnerBidAuthorizations,
  };
}

function getAuthorizedBidAmount(
  bidAuthorization: SignedBidAuthorization | undefined
): UsdcMinorUnits | null {
  const value = bidAuthorization?.payload.bidAmountMinorUnits;

  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const amount = BigInt(value);

  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return Number(amount);
}

function getWinningBidAmount(slot: SlotState): UsdcMinorUnits {
  return getAuthorizedBidAmount(slot.bidAuthorization) ?? getBidAmount(slot.bid);
}

function getBidAmount(bid: string): UsdcMinorUnits {
  try {
    return parseUSDCToMinorUnits(bid);
  } catch {
    return 0;
  }
}
