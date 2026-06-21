export type Advertisement = {
  name: string;
  company: string;
};

const STORAGE_KEY = "pdooh-ads";
const DEFAULT_ADVERTISEMENT_NAME = "Demo Advertisement";

export function getAdvertisements(): Advertisement[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return [];
  }

  try {
    const advertisements: Advertisement[] = JSON.parse(stored);

    return advertisements.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export function saveAdvertisements(advertisements: Advertisement[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(advertisements));
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
  companyName: string
) {
  if (advertisements.length > 0) {
    return advertisements;
  }

  return addAdvertisement(advertisements, {
    name: DEFAULT_ADVERTISEMENT_NAME,
    company: companyName,
  });
}