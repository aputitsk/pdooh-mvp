export type Advertisement = {
  name: string;
  company: string;
};

export type AuctionPhase = "open" | "locked" | "live";

export type AuctionSlotStatus = "available" | "won" | "paid";

export type AuctionBidSource = "advertiser" | "bot";

export type SlotState = {
  selectedAdvertisement: string;
  bid: string;
};

export type AuctionSlot = {
  id: string;
  label: string;
  price: number;
  status: AuctionSlotStatus;
};

export type AuctionBid = {
  slotId: string;
  advertisementId: string;
  amount: number;
  source: AuctionBidSource;
};

export type AuctionWinner = {
  slotId: string;
  advertisementId: string;
  amount: number;
  source: AuctionBidSource;
};

export type AuctionClock = {
  phase: AuctionPhase;
  secondsRemaining: number;
  currentSlotIndex: number;
  cycleId: number;
  elapsedInCycle: number;
};

export type AuctionAccess = {
  hasWallet: boolean;
  hasCompany: boolean;
  hasAdvertisement: boolean;
  balance: number;
};

export type AuctionState = {
  slots: AuctionSlot[];
  bids: AuctionBid[];
  winners: AuctionWinner[];
};