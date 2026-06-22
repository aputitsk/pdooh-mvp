const STORAGE_KEYS = {
  connected: "pdooh-wallet-connected",
  address: "pdooh-wallet-address",
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getStoredWalletConnected() {
  if (!isBrowser()) {
    return false;
  }

  return localStorage.getItem(STORAGE_KEYS.connected) === "true";
}

export function setStoredWalletConnected(value: boolean) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.connected, String(value));
}

export function getStoredWalletAddress() {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(STORAGE_KEYS.address);
}

export function setStoredWalletAddress(address: string) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.address, address);
}

export function resetStoredWallet() {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(STORAGE_KEYS.connected);
  localStorage.removeItem(STORAGE_KEYS.address);
}
