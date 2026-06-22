import {
  getStoredAdvertisements,
  setStoredAdvertisements,
} from "./advertisementStorage";
import type { Advertisement } from "./advertisementTypes";
export type { Advertisement } from "./advertisementTypes";

const DEFAULT_ADVERTISEMENT_NAME = "Demo Advertisement";

export function getAdvertisements(): Advertisement[] {
  return getStoredAdvertisements().sort((a, b) => a.name.localeCompare(b.name));
}

export function saveAdvertisements(advertisements: Advertisement[]) {
  setStoredAdvertisements(advertisements);
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
  advertisement: Advertisement
) {
  const nextAdvertisements = [...advertisements, advertisement].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  saveAdvertisements(nextAdvertisements);

  return nextAdvertisements;
}

export function deleteAdvertisement(
  advertisements: Advertisement[],
  name: string
) {
  const nextAdvertisements = advertisements.filter(
    (advertisement) => advertisement.name !== name
  );

  saveAdvertisements(nextAdvertisements);

  return nextAdvertisements;
}

export function createDefaultAdvertisement(
  advertisements: Advertisement[],
  businessName: string
) {
  if (advertisements.length > 0) {
    return advertisements;
  }

  return addAdvertisement(advertisements, {
    name: DEFAULT_ADVERTISEMENT_NAME,
    businessName,
  });
}
