import { useSyncExternalStore } from "react";
import {
  connectArcWallet,
  disconnectArcWallet,
  formatArcWalletAddress,
  getArcWalletState,
  getArcWalletProviders,
  refreshArcWalletState,
  setArcWalletChangeListener,
  type ArcWalletCatalogOption,
  type ArcWalletConnectResult,
} from "@/lib/arc/arcWalletAdapter";
import { notifyWalletChanged, subscribeToWalletChanges } from "./walletEvents";

export { subscribeToWalletChanges } from "./walletEvents";

export type { WalletState } from "./walletTypes";
export {
  useWalletUsdcBalance,
  type WalletUsdcBalanceState,
} from "./walletBalance";
export {
  useWalletEscrowBalance,
  type WalletEscrowBalanceState,
} from "./walletEscrowBalance";
export {
  sendWalletUsdcToTreasury,
  type WalletTransactionLifecycle,
} from "./walletTransactions";
export {
  depositWalletUsdcToEscrow,
  withdrawWalletUsdcFromEscrow,
  type WalletEscrowDepositLifecycle,
  type WalletEscrowDepositResult,
  type WalletEscrowWithdrawLifecycle,
  type WalletEscrowWithdrawResult,
} from "./walletEscrowTransactions";
export { signWalletBidAuthorization } from "./walletBidAuthorization";
export type WalletProviderOption = ArcWalletCatalogOption;

const restoringWalletSnapshot = "restoring|0||";

setArcWalletChangeListener(notifyWalletChanged);
void refreshArcWalletState();

function getWalletSnapshot() {
  const wallet = getWalletState();
  return `${wallet.status}|${wallet.connected ? "1" : "0"}|${wallet.address ?? ""}|${wallet.chainId ?? ""}`;
}

function getServerWalletSnapshot() {
  return restoringWalletSnapshot;
}

function parseWalletSnapshot(snapshot: string) {
  const [statusValue, connectedValue, addressValue, chainIdValue] =
    snapshot.split("|");
  const status =
    statusValue === "connected" ||
    statusValue === "disconnected" ||
    statusValue === "restoring"
      ? statusValue
      : "disconnected";

  return {
    status,
    connected: connectedValue === "1",
    address: addressValue || null,
    chainId: chainIdValue ? Number.parseInt(chainIdValue, 10) : null,
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
  return getArcWalletState();
}

export function isWalletConnected() {
  return getArcWalletState().connected;
}

export function getWalletAddress() {
  return getArcWalletState().address;
}

export function getWalletProviders() {
  return getArcWalletProviders();
}

export function connectWallet(
  providerId?: string
): Promise<ArcWalletConnectResult> {
  return connectArcWallet(providerId).catch((error: unknown) => ({
    ok: false,
    error:
      error instanceof Error
        ? error
        : new Error("Wallet connection failed", { cause: error }),
  }));
}

export function logOutWallet() {
  disconnectArcWallet();
}

export function formatWalletAddress(address: string) {
  return formatArcWalletAddress(address);
}
