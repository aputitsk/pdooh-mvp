import type { Advertisement, SlotState } from "./auctionTypes";
import { AUCTION_STORAGE_KEYS, AUCTION_SLOTS } from "./constants";
import { getStoredAdvertisements as getStoredWalletAdvertisements } from "@/lib/advertisements/advertisementStorage";
import {
  formatUSDCFromMinorUnits,
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

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

export function getAuctionStart() {
  const storage = getBrowserStorage();

  if (!storage) {
    return Date.now();
  }

  const storedValue = storage.getItem(AUCTION_STORAGE_KEYS.auctionStart);
  const parsedValue = storedValue ? Number(storedValue) : NaN;

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  const now = Date.now();
  storage.setItem(AUCTION_STORAGE_KEYS.auctionStart, String(now));

  return now;
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

export function getStoredAuctionCycleId() {
  const storage = getBrowserStorage();

  if (!storage) {
    return null;
  }

  return storage.getItem(AUCTION_STORAGE_KEYS.auctionCycleId);
}

export function setStoredAuctionCycleId(value: number) {
  const storage = getBrowserStorage();

  if (!storage) {
    return;
  }

  storage.setItem(AUCTION_STORAGE_KEYS.auctionCycleId, String(value));
}

export function getStoredSlotStates() {
  return readAuctionJson<SlotState[]>(
    AUCTION_STORAGE_KEYS.slotStates,
    createEmptySlotStates()
  );
}

export function setStoredSlotStates(value: SlotState[]) {
  writeAuctionJson(AUCTION_STORAGE_KEYS.slotStates, value);
}

export function getStoredSubmittedBids() {
  return readAuctionJson<boolean[]>(
    AUCTION_STORAGE_KEYS.submittedBids,
    createBooleanList(false)
  );
}

export function setStoredSubmittedBids(value: boolean[]) {
  writeAuctionJson(AUCTION_STORAGE_KEYS.submittedBids, value);
}

export function getStoredPaidSlots() {
  return readAuctionJson<boolean[]>(
    AUCTION_STORAGE_KEYS.paidSlots,
    createBooleanList(false)
  );
}

export function setStoredPaidSlots(value: boolean[]) {
  writeAuctionJson(AUCTION_STORAGE_KEYS.paidSlots, value);
}
