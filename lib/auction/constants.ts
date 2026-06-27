import { parseUSDCToMinorUnits } from "@/lib/money/usdc";

export const AUCTION_SLOTS = ["Slot 1", "Slot 2", "Slot 3"] as const;

export const AUCTION_OPEN_SECONDS = 60;
export const AUCTION_SELECTING_SECONDS = 2;
export const AUCTION_PLAYBACK_SECONDS_PER_SLOT = 10;

export const AUCTION_TOTAL_CYCLE_SECONDS =
  AUCTION_OPEN_SECONDS +
  AUCTION_SELECTING_SECONDS +
  AUCTION_PLAYBACK_SECONDS_PER_SLOT * AUCTION_SLOTS.length;

export const DEMO_BOT_BID = parseUSDCToMinorUnits("0.02");

export const DEMO_BOT_ADVERTISEMENT = {
  businessName: "Demo Bot",
  name: "Demo Advertisement",
} as const;

export const AUCTION_STORAGE_KEYS = {
  balance: "pdooh-balance",
  balanceMinorUnits: "pdooh-balance-minor-units",
  demoTreasury: "pdooh-demo-treasury",
  demoTreasuryMinorUnits: "pdooh-demo-treasury-minor-units",
  auctionStart: "pdooh-auction-start",
  auctionCycleId: "pdooh-auction-cycle-id",
  slotStates: "pdooh-auction-slot-states",
  submittedBids: "pdooh-auction-submitted-bids",
  paidSlots: "pdooh-auction-paid-slots",
  temporaryReservations: "pdooh-auction-temporary-reservations",
} as const;
