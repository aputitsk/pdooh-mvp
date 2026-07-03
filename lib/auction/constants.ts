import { parseUSDCToMinorUnits } from "@/lib/money/usdc";

export const AUCTION_SLOTS = ["Slot 1", "Slot 2", "Slot 3"] as const;

export const AUCTION_OPEN_SECONDS = 60;
export const AUCTION_SELECTING_SECONDS = 2;
export const AUCTION_PLAYBACK_SECONDS_PER_SLOT = 10;

export const AUCTION_TOTAL_CYCLE_SECONDS =
  AUCTION_OPEN_SECONDS +
  AUCTION_SELECTING_SECONDS +
  AUCTION_PLAYBACK_SECONDS_PER_SLOT * AUCTION_SLOTS.length;

export const MVP_DEMO_AUCTION_START_TIMESTAMP_MS = Date.UTC(
  2026,
  0,
  1,
  0,
  0,
  0
);

export const BID_AUTHORIZATION_TTL_MS = 30 * 60 * 1000;

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

export const AUCTION_SITE_STORAGE_PREFIX = "pdooh:v2:site";

export const AUCTION_SITE_STORAGE_KEYS = {
  auctionStart: "auction-start",
  auctionCycleId: "cycle-id",
  slotStates: "slot-states",
  submittedBids: "submitted-bids",
  paidSlots: "paid-slots",
  temporaryReservations: "temporary-reservations",
} as const;
