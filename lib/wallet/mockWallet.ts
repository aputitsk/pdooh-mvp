import { notifyWalletChanged } from "./walletEvents";
import {
  getStoredWalletAddress,
  getStoredWalletConnected,
  setStoredWalletAddress,
  setStoredWalletConnected,
} from "./walletStorage";
import type { WalletState } from "./walletTypes";

function generateMockWalletAddress() {
  const chars = "0123456789ABCDEF";
  let address = "0x";

  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }

  return address;
}

export function getWalletState(): WalletState {
  const connected = getStoredWalletConnected();

  return {
    status: connected ? "connected" : "disconnected",
    connected,
    address: getStoredWalletAddress(),
  };
}

export function isWalletConnected() {
  return getStoredWalletConnected();
}

export function getWalletAddress() {
  return getStoredWalletAddress();
}

export function connectWallet() {
  let address = getStoredWalletAddress();

  if (!address) {
    address = generateMockWalletAddress();
    setStoredWalletAddress(address);
  }

  setStoredWalletConnected(true);
  notifyWalletChanged();

  return address;
}

export function logOutWallet() {
  setStoredWalletConnected(false);
  notifyWalletChanged();
}

export function formatWalletAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
