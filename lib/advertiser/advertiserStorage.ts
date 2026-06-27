import {
  formatUSDCFromMinorUnits,
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

function getWalletStoragePrefix(walletAddress: string | null | undefined) {
  const normalizedAddress = walletAddress?.toLowerCase();

  return normalizedAddress ? `pdooh:${normalizedAddress}:` : null;
}

function getStorageKey(
  walletAddress: string | null | undefined,
  key: string
) {
  const prefix = getWalletStoragePrefix(walletAddress);

  return prefix ? `${prefix}${key}` : null;
}

function isBrowser() {
  return typeof window !== "undefined";
}

export function getStoredBusinessName(walletAddress?: string | null) {
  if (!isBrowser()) {
    return "";
  }

  const key = getStorageKey(walletAddress, "business-name");

  return key ? localStorage.getItem(key) || "" : "";
}

export function setStoredBusinessName(
  businessName: string,
  walletAddress?: string | null
) {
  if (!isBrowser()) {
    return;
  }

  const key = getStorageKey(walletAddress, "business-name");

  if (!key) {
    return;
  }

  localStorage.setItem(key, businessName);
}

export function getStoredBusinessProfileCreated(walletAddress?: string | null) {
  if (!isBrowser()) {
    return false;
  }

  const key = getStorageKey(walletAddress, "business-profile-created");

  return key ? localStorage.getItem(key) === "true" : false;
}

export function setStoredBusinessProfileCreated(
  value: boolean,
  walletAddress?: string | null
) {
  if (!isBrowser()) {
    return;
  }

  const key = getStorageKey(walletAddress, "business-profile-created");

  if (!key) {
    return;
  }

  localStorage.setItem(key, String(value));
}

export function getStoredAdvertiserBalance(
  walletAddress?: string | null,
  fallback = "0"
) {
  if (!isBrowser()) {
    return parseUSDCToMinorUnits(fallback);
  }

  const storedMinorUnits = readStoredBalanceMinorUnits(walletAddress);

  if (storedMinorUnits !== null) {
    setStoredAdvertiserBalance(storedMinorUnits, walletAddress);
    return storedMinorUnits;
  }

  const legacyMinorUnits = readLegacyBalanceMinorUnits(walletAddress);

  if (legacyMinorUnits !== null) {
    setStoredAdvertiserBalance(legacyMinorUnits, walletAddress);
    return legacyMinorUnits;
  }

  return parseUSDCToMinorUnits(fallback);
}

export function setStoredAdvertiserBalance(
  balance: UsdcMinorUnits,
  walletAddress?: string | null
) {
  if (!isBrowser()) {
    return;
  }

  const balanceMinorUnitsKey = getStorageKey(
    walletAddress,
    "balance-minor-units"
  );
  const balanceKey = getStorageKey(walletAddress, "balance");

  if (!balanceMinorUnitsKey || !balanceKey) {
    return;
  }

  localStorage.setItem(balanceMinorUnitsKey, String(balance));
  localStorage.setItem(balanceKey, formatUSDCFromMinorUnits(balance));
}

function readStoredBalanceMinorUnits(
  walletAddress?: string | null
): UsdcMinorUnits | null {
  const key = getStorageKey(walletAddress, "balance-minor-units");

  if (!key) {
    return null;
  }

  const value = localStorage.getItem(key);

  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const amount = Number(value);

  return Number.isSafeInteger(amount) ? amount : null;
}

function readLegacyBalanceMinorUnits(
  walletAddress?: string | null
): UsdcMinorUnits | null {
  const key = getStorageKey(walletAddress, "balance");

  if (!key) {
    return null;
  }

  const value = localStorage.getItem(key);

  if (!value) {
    return null;
  }

  try {
    return parseUSDCToMinorUnits(value);
  } catch {
    return null;
  }
}
