export const AUCTION_SLOTS = ["Slot 1", "Slot 2", "Slot 3"] as const;

export const AUCTION_OPEN_SECONDS = 40;
export const AUCTION_SELECTING_SECONDS = 2;
export const AUCTION_PLAYBACK_SECONDS_PER_SLOT = 10;

export const AUCTION_TOTAL_CYCLE_SECONDS =
  AUCTION_OPEN_SECONDS +
  AUCTION_SELECTING_SECONDS +
  AUCTION_PLAYBACK_SECONDS_PER_SLOT * AUCTION_SLOTS.length;

export const DEMO_BOT_BID = 0.02;

export const AUCTION_STORAGE_KEYS = {
  ads: "pdooh-ads",
  balance: "pdooh-balance",
  demoTreasury: "pdooh-demo-treasury",
  auctionStart: "pdooh-auction-start",
  auctionCycleId: "pdooh-auction-cycle-id",
  slotStates: "pdooh-auction-slot-states",
  submittedBids: "pdooh-auction-submitted-bids",
  paidSlots: "pdooh-auction-paid-slots",
} as const;