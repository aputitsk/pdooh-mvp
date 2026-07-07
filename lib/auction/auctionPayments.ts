import type { Advertisement } from "./auctionTypes";
import type { UsdcMinorUnits } from "@/lib/money/usdc";

export type AuctionPaymentResult = {
  paidSlots: boolean[];
  walletBalance: UsdcMinorUnits;
  demoTreasury: UsdcMinorUnits;
};

export function processAuctionSlotPayment(params: {
  slotIndex: number;
  paidSlots: boolean[];
  winners: Advertisement[];
  winnerBidAmounts: UsdcMinorUnits[];
  walletBalance: UsdcMinorUnits;
  demoTreasury: UsdcMinorUnits;
}): AuctionPaymentResult {
  const { slotIndex, paidSlots, walletBalance, demoTreasury } = params;

  if (paidSlots[slotIndex]) {
    return {
      paidSlots,
      walletBalance,
      demoTreasury,
    };
  }

  const nextPaidSlots = paidSlots.map((isPaid, index) => {
    return index === slotIndex ? true : isPaid;
  });

  return {
    paidSlots: nextPaidSlots,
    walletBalance,
    demoTreasury,
  };
}

export function processAllAuctionSlotPayments(params: {
  paidSlots: boolean[];
  winners: Advertisement[];
  winnerBidAmounts: UsdcMinorUnits[];
  walletBalance: UsdcMinorUnits;
  demoTreasury: UsdcMinorUnits;
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
