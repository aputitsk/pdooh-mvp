import type { Advertisement, SlotState } from "./auctionTypes";
import { DEMO_BOT_ADVERTISEMENT, DEMO_BOT_BID } from "./constants";
import {
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

export type AuctionWinnersResult = {
  winners: Advertisement[];
  winnerBidAmounts: UsdcMinorUnits[];
};

export function selectAuctionWinners(params: {
  slotStates: SlotState[];
  submittedBids: boolean[];
  advertisements: Advertisement[];
}): AuctionWinnersResult {
  const { slotStates, submittedBids, advertisements } = params;

  const winners = slotStates.map((slot, index) => {
    const userBid = getBidAmount(slot.bid);

    const advertisement = advertisements.find(
      (item) => item.name === slot.selectedAdvertisement
    );

    if (
      !submittedBids[index] ||
      !advertisement ||
      !userBid ||
      userBid <= DEMO_BOT_BID
    ) {
      return DEMO_BOT_ADVERTISEMENT;
    }

    return advertisement;
  });

  const winnerBidAmounts = slotStates.map((slot, index) => {
    const userBid = getBidAmount(slot.bid);
    const winner = winners[index];

    if (winner.businessName === DEMO_BOT_ADVERTISEMENT.businessName) {
      return 0;
    }

    return userBid;
  });

  return {
    winners,
    winnerBidAmounts,
  };
}

function getBidAmount(bid: string): UsdcMinorUnits {
  try {
    return parseUSDCToMinorUnits(bid);
  } catch {
    return 0;
  }
}
