import type { Advertisement } from "./advertisementTypes";

function isBrowser() {
  return typeof window !== "undefined";
}

function getAdvertisementsStorageKey(walletAddress: string | null | undefined) {
  const normalizedAddress = walletAddress?.toLowerCase();

  return normalizedAddress ? `pdooh:${normalizedAddress}:ads` : null;
}

export function getStoredAdvertisements(walletAddress?: string | null) {
  if (!isBrowser()) {
    return [];
  }

  const key = getAdvertisementsStorageKey(walletAddress);

  if (!key) {
    return [];
  }

  const stored = localStorage.getItem(key);

  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as Advertisement[];
  } catch {
    return [];
  }
}

export function setStoredAdvertisements(
  advertisements: Advertisement[],
  walletAddress?: string | null
) {
  if (!isBrowser()) {
    return;
  }

  const key = getAdvertisementsStorageKey(walletAddress);

  if (!key) {
    return;
  }

  localStorage.setItem(key, JSON.stringify(advertisements));
}
