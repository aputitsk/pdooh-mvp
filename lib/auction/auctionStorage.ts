import type { Advertisement, SiteKey, SlotState } from "./auctionTypes";
import {
  AUCTION_SITE_STORAGE_KEYS,
  AUCTION_SITE_STORAGE_PREFIX,
  AUCTION_STORAGE_KEYS,
  AUCTION_SLOTS,
} from "./constants";
import { DEFAULT_SITE_KEY, getSiteConfig } from "./siteConfig";
import { getStoredAdvertisements as getStoredWalletAdvertisements } from "@/lib/advertisements/advertisementStorage";
import {
  formatUSDCFromMinorUnits,
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

type AuctionSiteStorageKey = keyof typeof AUCTION_SITE_STORAGE_KEYS;

export type AuctionStorageState = {
  auctionStartTimestampMs: number;
  auctionCycleId: string | null;
  slotStates: SlotState[];
  submittedBids: boolean[];
  paidSlots: boolean[];
};

export function createEmptySlotStates(): SlotState[] {
  return AUCTION_SLOTS.map(() => ({
    selectedAdvertisement: "",
    bid: "",
    advertiserAddress: null,
  }));
}

export function createBooleanList(value: boolean): boolean[] {
  return AUCTION_SLOTS.map(() => value);
}

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function readMinorUnits(key: string): UsdcMinorUnits | null {
  const storage = getBrowserStorage();

  if (!storage) {
    return null;
  }

  const value = storage.getItem(key);

  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const amount = BigInt(value);

  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return JSON.parse(value) as UsdcMinorUnits;
}

function readLegacyUSDCAmount(key: string): UsdcMinorUnits | null {
  const storage = getBrowserStorage();

  if (!storage) {
    return null;
  }

  const value = storage.getItem(key);

  if (!value) {
    return null;
  }

  try {
    return parseUSDCToMinorUnits(value);
  } catch {
    return null;
  }
}

function writeUSDCMoney(
  minorUnitsKey: string,
  legacyKey: string,
  value: UsdcMinorUnits
) {
  const storage = getBrowserStorage();

  if (!storage) {
    return;
  }

  storage.setItem(minorUnitsKey, String(value));
  storage.setItem(legacyKey, formatUSDCFromMinorUnits(value));
}

export function getAuctionSiteStorageKey(
  siteKey: SiteKey = DEFAULT_SITE_KEY,
  key: AuctionSiteStorageKey
) {
  return `${AUCTION_SITE_STORAGE_PREFIX}:${siteKey}:${AUCTION_SITE_STORAGE_KEYS[key]}`;
}

export function readAuctionJson<T>(key: string, fallback: T): T {
  const storage = getBrowserStorage();

  if (!storage) {
    return fallback;
  }

  try {
    const value = storage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function writeAuctionJson<T>(key: string, value: T) {
  const storage = getBrowserStorage();

  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

function setStoredAuctionStart(
  value: number,
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  const storage = getBrowserStorage();

  if (storage) {
    const auctionStart = String(value);
    const key = getAuctionSiteStorageKey(siteKey, "auctionStart");

    if (storage.getItem(key) !== auctionStart) {
      storage.setItem(key, auctionStart);
    }
  }
}

export function getAuctionStart(siteKey: SiteKey = DEFAULT_SITE_KEY) {
  const auctionStart = getSiteConfig(siteKey).auctionStartTimestampMs;

  setStoredAuctionStart(auctionStart, siteKey);

  return auctionStart;
}

export function getStoredAdvertisements(walletAddress?: string | null) {
  return getStoredWalletAdvertisements(walletAddress) as Advertisement[];
}

export function getStoredWalletBalance() {
  const storedMinorUnits = readMinorUnits(AUCTION_STORAGE_KEYS.balanceMinorUnits);

  if (storedMinorUnits !== null) {
    setStoredWalletBalance(storedMinorUnits);
    return storedMinorUnits;
  }

  const legacyMinorUnits = readLegacyUSDCAmount(AUCTION_STORAGE_KEYS.balance);

  if (legacyMinorUnits !== null) {
    setStoredWalletBalance(legacyMinorUnits);
    return legacyMinorUnits;
  }

  return 0;
}

export function setStoredWalletBalance(value: UsdcMinorUnits) {
  writeUSDCMoney(
    AUCTION_STORAGE_KEYS.balanceMinorUnits,
    AUCTION_STORAGE_KEYS.balance,
    value
  );
}

export function getStoredDemoTreasury() {
  const storedMinorUnits = readMinorUnits(
    AUCTION_STORAGE_KEYS.demoTreasuryMinorUnits
  );

  if (storedMinorUnits !== null) {
    setStoredDemoTreasury(storedMinorUnits);
    return storedMinorUnits;
  }

  const legacyMinorUnits = readLegacyUSDCAmount(
    AUCTION_STORAGE_KEYS.demoTreasury
  );

  if (legacyMinorUnits !== null) {
    setStoredDemoTreasury(legacyMinorUnits);
    return legacyMinorUnits;
  }

  return 0;
}

export function setStoredDemoTreasury(value: UsdcMinorUnits) {
  writeUSDCMoney(
    AUCTION_STORAGE_KEYS.demoTreasuryMinorUnits,
    AUCTION_STORAGE_KEYS.demoTreasury,
    value
  );
}

export function getStoredAuctionCycleId(siteKey: SiteKey = DEFAULT_SITE_KEY) {
  const storage = getBrowserStorage();

  if (!storage) {
    return null;
  }

  return storage.getItem(getAuctionSiteStorageKey(siteKey, "auctionCycleId"));
}

export function setStoredAuctionCycleId(
  value: number,
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  const storage = getBrowserStorage();

  if (!storage) {
    return;
  }

  storage.setItem(
    getAuctionSiteStorageKey(siteKey, "auctionCycleId"),
    String(value)
  );
}

export function getStoredSlotStates(siteKey: SiteKey = DEFAULT_SITE_KEY) {
  return readAuctionJson<SlotState[]>(
    getAuctionSiteStorageKey(siteKey, "slotStates"),
    createEmptySlotStates()
  );
}

export function setStoredSlotStates(
  value: SlotState[],
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  writeAuctionJson(getAuctionSiteStorageKey(siteKey, "slotStates"), value);
}

export function getStoredSubmittedBids(siteKey: SiteKey = DEFAULT_SITE_KEY) {
  return readAuctionJson<boolean[]>(
    getAuctionSiteStorageKey(siteKey, "submittedBids"),
    createBooleanList(false)
  );
}

export function setStoredSubmittedBids(
  value: boolean[],
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  writeAuctionJson(getAuctionSiteStorageKey(siteKey, "submittedBids"), value);
}

export function getStoredPaidSlots(siteKey: SiteKey = DEFAULT_SITE_KEY) {
  return readAuctionJson<boolean[]>(
    getAuctionSiteStorageKey(siteKey, "paidSlots"),
    createBooleanList(false)
  );
}

export function setStoredPaidSlots(
  value: boolean[],
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  writeAuctionJson(getAuctionSiteStorageKey(siteKey, "paidSlots"), value);
}

export function loadAuctionState(
  siteKey: SiteKey = DEFAULT_SITE_KEY
): AuctionStorageState {
  return {
    auctionStartTimestampMs: getAuctionStart(siteKey),
    auctionCycleId: getStoredAuctionCycleId(siteKey),
    slotStates: getStoredSlotStates(siteKey),
    submittedBids: getStoredSubmittedBids(siteKey),
    paidSlots: getStoredPaidSlots(siteKey),
  };
}

export function saveAuctionState(
  siteKey: SiteKey = DEFAULT_SITE_KEY,
  state: Partial<AuctionStorageState>
) {
  if (state.auctionStartTimestampMs !== undefined) {
    setStoredAuctionStart(state.auctionStartTimestampMs, siteKey);
  }

  if (state.auctionCycleId !== undefined && state.auctionCycleId !== null) {
    const parsedCycleId = Number(state.auctionCycleId);

    if (Number.isSafeInteger(parsedCycleId)) {
      setStoredAuctionCycleId(parsedCycleId, siteKey);
    }
  }

  if (state.slotStates) {
    setStoredSlotStates(state.slotStates, siteKey);
  }

  if (state.submittedBids) {
    setStoredSubmittedBids(state.submittedBids, siteKey);
  }

  if (state.paidSlots) {
    setStoredPaidSlots(state.paidSlots, siteKey);
  }
}
