import type { Advertisement } from "./advertisementTypes";

const STORAGE_KEYS = {
  advertisements: "pdooh-ads",
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getStoredAdvertisements() {
  if (!isBrowser()) {
    return [];
  }

  const stored = localStorage.getItem(STORAGE_KEYS.advertisements);

  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as Advertisement[];
  } catch {
    return [];
  }
}

export function setStoredAdvertisements(advertisements: Advertisement[]) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(
    STORAGE_KEYS.advertisements,
    JSON.stringify(advertisements)
  );
}

export function resetStoredAdvertisements() {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(STORAGE_KEYS.advertisements);
}
