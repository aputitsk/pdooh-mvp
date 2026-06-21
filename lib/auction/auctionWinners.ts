import type { Advertisement, SlotState } from "./auctionTypes";
import { DEMO_BOT_BID } from "./constants";

export const DEMO_BOT_ADVERTISEMENT: Advertisement = {
  company: "Demo Bot",
  name: "Demo Advertisement",
};

export type AuctionWinnersResult = {
  winners: Advertisement[];
  winnerBidAmounts: number[];
};

export function selectAuctionWinners(params: {
  slotStates: SlotState[];
  submittedBids: boolean[];
  advertisements: Advertisement[];
}): AuctionWinnersResult {
  const { slotStates, submittedBids, advertisements } = params;

  const winners = slotStates.map((slot, index) => {
    const userBid = Number(slot.bid);

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
    const userBid = Number(slot.bid);
    const winner = winners[index];

    if (winner.company === DEMO_BOT_ADVERTISEMENT.company) {
      return 0;
    }

    return userBid;
  });

  return {
    winners,
    winnerBidAmounts,
  };
}