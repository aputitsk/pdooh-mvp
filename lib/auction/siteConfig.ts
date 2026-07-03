import type {
  AuctionSlotId,
  MarketConfig,
  MarketId,
  SiteConfig,
  SiteId,
  SiteKey,
} from "./auctionTypes";
import {
  AUCTION_OPEN_SECONDS,
  AUCTION_SELECTING_SECONDS,
  MVP_DEMO_AUCTION_START_TIMESTAMP_MS,
} from "./constants";

export const DEFAULT_MARKET_ID: MarketId = "new-york";
export const DEFAULT_SITE_ID: SiteId = "times-square";
export const NEW_YORK_TIMES_SQUARE_SITE_KEY: SiteKey =
  "new-york/times-square";
export const LOS_ANGELES_HOLLYWOOD_BOULEVARD_SITE_KEY: SiteKey =
  "los-angeles/hollywood-boulevard";
export const DEFAULT_SITE_KEY: SiteKey = NEW_YORK_TIMES_SQUARE_SITE_KEY;

export const AUCTION_SLOT_IDS = [
  "slot-1",
  "slot-2",
  "slot-3",
] as const satisfies readonly AuctionSlotId[];

const LOS_ANGELES_AUCTION_START_TIMESTAMP_MS =
  MVP_DEMO_AUCTION_START_TIMESTAMP_MS +
  (AUCTION_OPEN_SECONDS + AUCTION_SELECTING_SECONDS) * 1000;

export const MARKET_CONFIGS: readonly MarketConfig[] = [
  {
    id: "new-york",
    name: "New York",
    sites: [
      {
        marketId: "new-york",
        siteId: "times-square",
        siteKey: "new-york/times-square",
        name: "Times Square",
        slotIds: AUCTION_SLOT_IDS,
        auctionStartTimestampMs: MVP_DEMO_AUCTION_START_TIMESTAMP_MS,
      },
    ],
  },
  {
    id: "los-angeles",
    name: "Los Angeles",
    sites: [
      {
        marketId: "los-angeles",
        siteId: "hollywood-boulevard",
        siteKey: "los-angeles/hollywood-boulevard",
        name: "Hollywood Boulevard",
        slotIds: AUCTION_SLOT_IDS,
        auctionStartTimestampMs: LOS_ANGELES_AUCTION_START_TIMESTAMP_MS,
      },
    ],
  },
] as const;

export const SITE_CONFIGS: readonly SiteConfig[] = MARKET_CONFIGS.flatMap(
  (market) => market.sites
);

export const DEFAULT_SITE_CONFIG: SiteConfig =
  SITE_CONFIGS.find((site) => site.siteKey === DEFAULT_SITE_KEY) ??
  MARKET_CONFIGS[0].sites[0];

export function getSiteConfig(siteKey: SiteKey = DEFAULT_SITE_KEY): SiteConfig {
  return (
    SITE_CONFIGS.find((site) => site.siteKey === siteKey) ??
    DEFAULT_SITE_CONFIG
  );
}

export function findSiteConfigByIdentity(
  marketId: string,
  siteId: string
): SiteConfig | null {
  return (
    SITE_CONFIGS.find(
      (site) => site.marketId === marketId && site.siteId === siteId
    ) ?? null
  );
}
