import {
  getStoredAdvertisements,
  setStoredAdvertisements,
} from "./advertisementStorage";
import type { Advertisement } from "./advertisementTypes";
export type { Advertisement } from "./advertisementTypes";

const DEFAULT_ADVERTISEMENT_NAME = "Demo Advertisement";
export const ADVERTISEMENT_NAME_MAX_LENGTH = 30;

type AdvertisementInput = Omit<Advertisement, "createdAt"> &
  Partial<Pick<Advertisement, "createdAt">>;

export function getAdvertisements(
  walletAddress?: string | null
): Advertisement[] {
  return sortAdvertisementsByCreatedAt(getStoredAdvertisements(walletAddress));
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

export function advertisementExistsExcept(
  advertisements: Advertisement[],
  name: string,
  currentName: string
) {
  const normalized = name.trim().toLowerCase();
  const normalizedCurrentName = currentName.trim().toLowerCase();

  return advertisements.some((advertisement) => {
    const advertisementName = advertisement.name.trim().toLowerCase();

    return (
      advertisementName === normalized &&
      advertisementName !== normalizedCurrentName
    );
  });
}

export function addAdvertisement(
  advertisements: Advertisement[],
  advertisement: AdvertisementInput,
  walletAddress?: string | null
) {
  const nextAdvertisements = sortAdvertisementsByCreatedAt([
    {
      ...advertisement,
      createdAt: getValidCreatedAt(advertisement.createdAt, Date.now()),
    },
    ...advertisements,
  ]);

  saveAdvertisements(nextAdvertisements, walletAddress);

  return nextAdvertisements;
}

export function updateAdvertisementName(
  advertisements: Advertisement[],
  currentName: string,
  nextName: string,
  walletAddress?: string | null
) {
  const trimmedNextName = nextName.trim();
  const nextAdvertisements = sortAdvertisementsByCreatedAt(
    advertisements.map((advertisement) =>
      advertisement.name === currentName
        ? { ...advertisement, name: trimmedNextName }
        : advertisement
    )
  );

  saveAdvertisements(nextAdvertisements, walletAddress);

  return nextAdvertisements;
}

export function updateAdvertisementsBusinessName(
  advertisements: Advertisement[],
  businessName: string,
  walletAddress?: string | null
) {
  const nextAdvertisements = sortAdvertisementsByCreatedAt(
    advertisements.map((advertisement) => ({
      ...advertisement,
      businessName,
    }))
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

function sortAdvertisementsByCreatedAt(advertisements: Advertisement[]) {
  return [...advertisements].sort(
    (a, b) => getCreatedAtForSort(b) - getCreatedAtForSort(a)
  );
}

function getCreatedAtForSort(advertisement: Advertisement) {
  return getValidCreatedAt(advertisement.createdAt, 0);
}

function getValidCreatedAt(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}
