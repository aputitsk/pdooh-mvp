import {
  getStoredAdvertisements,
  setStoredAdvertisements,
} from "./advertisementStorage";
import type { Advertisement } from "./advertisementTypes";
export type { Advertisement } from "./advertisementTypes";

const DEFAULT_ADVERTISEMENT_NAME = "Demo Advertisement";

export function getAdvertisements(
  walletAddress?: string | null
): Advertisement[] {
  return getStoredAdvertisements(walletAddress).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function saveAdvertisements(
  advertisements: Advertisement[],
  walletAddress?: string | null
) {
  setStoredAdvertisements(advertisements, walletAddress);
}

export function advertisementExists(
  advertisements: Advertisement[],
  name: string
) {
  const normalized = name.trim().toLowerCase();

  return advertisements.some(
    (advertisement) =>
      advertisement.name.trim().toLowerCase() === normalized
  );
}

export function addAdvertisement(
  advertisements: Advertisement[],
  advertisement: Advertisement,
  walletAddress?: string | null
) {
  const nextAdvertisements = [...advertisements, advertisement].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  saveAdvertisements(nextAdvertisements, walletAddress);

  return nextAdvertisements;
}

export function deleteAdvertisement(
  advertisements: Advertisement[],
  name: string,
  walletAddress?: string | null
) {
  const nextAdvertisements = advertisements.filter(
    (advertisement) => advertisement.name !== name
  );

  saveAdvertisements(nextAdvertisements, walletAddress);

  return nextAdvertisements;
}

export function createDefaultAdvertisement(
  advertisements: Advertisement[],
  businessName: string,
  walletAddress?: string | null
) {
  if (advertisements.length > 0) {
    return advertisements;
  }

  return addAdvertisement(
    advertisements,
    {
      name: DEFAULT_ADVERTISEMENT_NAME,
      businessName,
    },
    walletAddress
  );
}
