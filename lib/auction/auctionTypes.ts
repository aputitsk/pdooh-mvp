import type { UsdcMinorUnits } from "@/lib/money/usdc";

type HexAddress = `0x${string}`;
type HexSignature = `0x${string}`;

export type MarketId = "new-york" | "los-angeles";

export type SiteId = "times-square" | "hollywood-boulevard";

export type SiteKey = `${MarketId}/${SiteId}`;

export type AuctionSlotId = "slot-1" | "slot-2" | "slot-3";

export type SiteIdentity = {
  marketId: MarketId;
  siteId: SiteId;
  siteKey: SiteKey;
};

export type SiteConfig = SiteIdentity & {
  name: string;
  slotIds: readonly AuctionSlotId[];
  auctionStartTimestampMs: number;
};

export type MarketConfig = {
  id: MarketId;
  name: string;
  sites: readonly SiteConfig[];
};

export type Advertisement = {
  name: string;
  businessName: string;
};

export type BidAuthorizationPayload = {
  purpose: "PDOOH_BID_AUTHORIZATION";
  version: "2";
  marketId: MarketId;
  siteId: SiteId;
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

export type SiteScopedBidAuthorizationPayload =
  BidAuthorizationPayload & SiteIdentity;

export type AuctionPhase = "open" | "locked" | "live";

export type SlotState = {
  selectedAdvertisement: string;
  bid: string;
  advertiserAddress: `0x${string}` | null;
  bidAuthorization?: SignedBidAuthorization;
};

export type AuctionClock = {
  phase: AuctionPhase;
  secondsRemaining: number;
  currentSlotIndex: number;
  cycleId: number;
  elapsedInCycle: number;
};

export type SiteAuctionState = SiteIdentity & {
  auctionStartTimestampMs: number;
  clock: AuctionClock;
  slotStates: SlotState[];
  submittedBids: boolean[];
  paidSlots: boolean[];
  winners: Advertisement[];
  winnerBidAmounts: UsdcMinorUnits[];
  winnerAdvertiserAddresses: (`0x${string}` | null)[];
  winnerBidAuthorizations: (SignedBidAuthorization | null)[];
};
