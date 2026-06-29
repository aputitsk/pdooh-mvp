import type { UsdcMinorUnits } from "@/lib/money/usdc";

type HexAddress = `0x${string}`;
type HexSignature = `0x${string}`;

export type Advertisement = {
  name: string;
  businessName: string;
};

export type BidAuthorizationPayload = {
  purpose: "PDOOH_BID_AUTHORIZATION";
  version: "1";
  advertiserAddress: HexAddress;
  businessName: string;
  advertisementName: string;
  slotId: string;
  cycleId: string;
  bidAmountMinorUnits: string;
  chainId: number;
  escrowAddress: HexAddress;
  treasuryAddress: HexAddress;
  usdcAddress: HexAddress;
  expiresAt: string;
};

export type SignedBidAuthorization = {
  payload: BidAuthorizationPayload;
  signature: HexSignature;
};

export type AuctionPhase = "open" | "locked" | "live";

export type AuctionSlotStatus = "available" | "won" | "paid";

export type AuctionBidSource = "advertiser" | "bot";

export type SlotState = {
  selectedAdvertisement: string;
  bid: string;
  advertiserAddress: `0x${string}` | null;
  bidAuthorization?: SignedBidAuthorization;
};

export type AuctionSlot = {
  id: string;
  label: string;
  price: UsdcMinorUnits;
  status: AuctionSlotStatus;
};

export type AuctionBid = {
  slotId: string;
  advertisementId: string;
  amount: UsdcMinorUnits;
  source: AuctionBidSource;
  advertiserAddress: `0x${string}`;
};

export type AuctionWinner = {
  slotId: string;
  advertisementId: string;
  amount: UsdcMinorUnits;
  source: AuctionBidSource;
  advertiserAddress: `0x${string}` | null;
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
  hasBusinessProfile: boolean;
  hasAdvertisement: boolean;
  availableAuctionCapacity: UsdcMinorUnits;
};

export type AuctionState = {
  slots: AuctionSlot[];
  bids: AuctionBid[];
  winners: AuctionWinner[];
};
