import type { Advertisement } from "./auctionTypes";
import { DEMO_BOT_ADVERTISEMENT } from "./auctionWinners";

export type AuctionPaymentResult = {
  paidSlots: boolean[];
  walletBalance: number;
  demoTreasury: number;
};

export function processAuctionSlotPayment(params: {
  slotIndex: number;
  paidSlots: boolean[];
  winners: Advertisement[];
  winnerBidAmounts: number[];
  walletBalance: number;
  demoTreasury: number;
}): AuctionPaymentResult {
  const {
    slotIndex,
    paidSlots,
    winners,
    winnerBidAmounts,
    walletBalance,
    demoTreasury,
  } = params;

  if (paidSlots[slotIndex]) {
    return {
      paidSlots,
      walletBalance,
      demoTreasury,
    };
  }

  const winner = winners[slotIndex];
  const paymentAmount = winnerBidAmounts[slotIndex];

  const nextPaidSlots = paidSlots.map((isPaid, index) => {
    return index === slotIndex ? true : isPaid;
  });

  if (winner.company === DEMO_BOT_ADVERTISEMENT.company) {
    return {
      paidSlots: nextPaidSlots,
      walletBalance,
      demoTreasury,
    };
  }

  if (!paymentAmount || paymentAmount <= 0) {
    return {
      paidSlots: nextPaidSlots,
      walletBalance,
      demoTreasury,
    };
  }

  return {
    paidSlots: nextPaidSlots,
    walletBalance: Math.max(walletBalance - paymentAmount, 0),
    demoTreasury: demoTreasury + paymentAmount,
  };
}

export function processAllAuctionSlotPayments(params: {
  paidSlots: boolean[];
  winners: Advertisement[];
  winnerBidAmounts: number[];
  walletBalance: number;
  demoTreasury: number;
}): AuctionPaymentResult {
  const { paidSlots, winners, winnerBidAmounts, walletBalance, demoTreasury } =
    params;

  return paidSlots.reduce<AuctionPaymentResult>(
    (currentResult, _, slotIndex) => {
      return processAuctionSlotPayment({
        slotIndex,
        paidSlots: currentResult.paidSlots,
        winners,
        winnerBidAmounts,
        walletBalance: currentResult.walletBalance,
        demoTreasury: currentResult.demoTreasury,
      });
    },
    {
      paidSlots,
      walletBalance,
      demoTreasury,
    }
  );
}