import {
  formatUSDCFromMinorUnits,
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

const STORAGE_KEYS = {
  businessName: "pdooh-business-name",
  businessProfileCreated: "pdooh-business-profile-created",
  balance: "pdooh-balance",
  balanceMinorUnits: "pdooh-balance-minor-units",
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getStoredBusinessName() {
  if (!isBrowser()) {
    return "";
  }

  return localStorage.getItem(STORAGE_KEYS.businessName) || "";
}

export function setStoredBusinessName(businessName: string) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.businessName, businessName);
}

export function getStoredBusinessProfileCreated() {
  if (!isBrowser()) {
    return false;
  }

  return localStorage.getItem(STORAGE_KEYS.businessProfileCreated) === "true";
}

export function setStoredBusinessProfileCreated(value: boolean) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.businessProfileCreated, String(value));
}

export function getStoredAdvertiserBalance(fallback = "0") {
  if (!isBrowser()) {
    return parseUSDCToMinorUnits(fallback);
  }

  const storedMinorUnits = readStoredBalanceMinorUnits();

  if (storedMinorUnits !== null) {
    setStoredAdvertiserBalance(storedMinorUnits);
    return storedMinorUnits;
  }

  const legacyMinorUnits = readLegacyBalanceMinorUnits();

  if (legacyMinorUnits !== null) {
    setStoredAdvertiserBalance(legacyMinorUnits);
    return legacyMinorUnits;
  }

  return parseUSDCToMinorUnits(fallback);
}

export function setStoredAdvertiserBalance(balance: UsdcMinorUnits) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.balanceMinorUnits, String(balance));
  localStorage.setItem(STORAGE_KEYS.balance, formatUSDCFromMinorUnits(balance));
}

function readStoredBalanceMinorUnits(): UsdcMinorUnits | null {
  const value = localStorage.getItem(STORAGE_KEYS.balanceMinorUnits);

  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const amount = Number(value);

  return Number.isSafeInteger(amount) ? amount : null;
}

function readLegacyBalanceMinorUnits(): UsdcMinorUnits | null {
  const value = localStorage.getItem(STORAGE_KEYS.balance);

  if (!value) {
    return null;
  }

  try {
    return parseUSDCToMinorUnits(value);
  } catch {
    return null;
  }
}
