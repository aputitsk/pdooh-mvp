const STORAGE_KEYS = {
  ads: "pdooh-ads",
  balance: "pdooh-balance",
  treasury: "pdooh-demo-treasury",
  cycleId: "pdooh-auction-cycle-id",
  slotStates: "pdooh-auction-slot-states",
  submittedBids: "pdooh-auction-submitted-bids",
  paidSlots: "pdooh-auction-paid-slots",
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getStoredAdvertisements() {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(STORAGE_KEYS.ads);
}

export function setStoredAdvertisements(value: string) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.ads, value);
}

export function getStoredWalletBalance() {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(STORAGE_KEYS.balance);
}

export function setStoredWalletBalance(value: number) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.balance, String(value));
}

export function getStoredDemoTreasury() {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(STORAGE_KEYS.treasury);
}

export function setStoredDemoTreasury(value: number) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.treasury, String(value));
}

export function getStoredAuctionCycleId() {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(STORAGE_KEYS.cycleId);
}

export function setStoredAuctionCycleId(value: number) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.cycleId, String(value));
}

export function getStoredSlotStates() {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(STORAGE_KEYS.slotStates);
}

export function setStoredSlotStates(value: string) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.slotStates, value);
}

export function getStoredSubmittedBids() {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(STORAGE_KEYS.submittedBids);
}

export function setStoredSubmittedBids(value: string) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.submittedBids, value);
}

export function getStoredPaidSlots() {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(STORAGE_KEYS.paidSlots);
}

export function setStoredPaidSlots(value: string) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.paidSlots, value);
}