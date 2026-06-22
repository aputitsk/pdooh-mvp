import { useSyncExternalStore } from "react";
import {
  connectWallet as connectDemoWallet,
  formatWalletAddress as formatDemoWalletAddress,
  getWalletAddress as getDemoWalletAddress,
  getWalletState as getDemoWalletState,
  isWalletConnected as isDemoWalletConnected,
  logOutWallet as logOutDemoWallet,
} from "./mockWallet";
import { subscribeToWalletChanges } from "./walletEvents";
import { resetStoredWallet } from "./walletStorage";

export { subscribeToWalletChanges } from "./walletEvents";

export type { WalletState } from "./walletTypes";

const disconnectedWalletSnapshot = "0|";

function getWalletSnapshot() {
  const wallet = getWalletState();
  return `${wallet.connected ? "1" : "0"}|${wallet.address ?? ""}`;
}

function getServerWalletSnapshot() {
  return disconnectedWalletSnapshot;
}

function parseWalletSnapshot(snapshot: string) {
  const [connectedValue, addressValue] = snapshot.split("|");

  return {
    connected: connectedValue === "1",
    address: addressValue || null,
  };
}

export function useWalletStore() {
  const walletSnapshot = useSyncExternalStore(
    subscribeToWalletChanges,
    getWalletSnapshot,
    getServerWalletSnapshot
  );

  return parseWalletSnapshot(walletSnapshot);
}

export function getWalletState() {
  return getDemoWalletState();
}

export function isWalletConnected() {
  return isDemoWalletConnected();
}

export function getWalletAddress() {
  return getDemoWalletAddress();
}

export function connectWallet() {
  return connectDemoWallet();
}

export function logOutWallet() {
  logOutDemoWallet();
}

export function resetWallet() {
  resetStoredWallet();
}

export function formatWalletAddress(address: string) {
  return formatDemoWalletAddress(address);
}