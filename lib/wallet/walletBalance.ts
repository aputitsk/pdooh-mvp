"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { ARC_CHAIN_ID } from "@/lib/arc/arcConstants";
import { getArcUsdcBalance } from "@/lib/arc/arcBalanceAdapter";
import {
  formatUSDCFromMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";
import { getArcWalletState } from "@/lib/arc/arcWalletAdapter";
import { subscribeToWalletChanges } from "./walletEvents";
import type { WalletState } from "./walletTypes";

export type WalletUsdcBalanceState = {
  status: "idle" | "loading" | "ready" | "error";
  balance: UsdcMinorUnits | null;
  formattedBalance: string;
  error: string | null;
  refresh: () => void;
};

type InternalWalletUsdcBalanceState = Omit<
  WalletUsdcBalanceState,
  "refresh"
> & {
  address: string | null;
};

const idleBalanceState: InternalWalletUsdcBalanceState = {
  status: "idle",
  balance: null,
  formattedBalance: "0",
  error: null,
  address: null,
};
const restoringWalletSnapshot = "restoring|0||";

function getWalletSnapshot() {
  const wallet = getArcWalletState();
  return `${wallet.status}|${wallet.connected ? "1" : "0"}|${wallet.address ?? ""}|${wallet.chainId ?? ""}`;
}

function getServerWalletSnapshot() {
  return restoringWalletSnapshot;
}

function parseWalletSnapshot(snapshot: string): WalletState {
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

function getBalanceErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to read USDC balance.";
}

export function useWalletUsdcBalance(): WalletUsdcBalanceState {
  const walletSnapshot = useSyncExternalStore(
    subscribeToWalletChanges,
    getWalletSnapshot,
    getServerWalletSnapshot
  );
  const wallet = parseWalletSnapshot(walletSnapshot);
  const [balanceState, setBalanceState] =
    useState<InternalWalletUsdcBalanceState>(idleBalanceState);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refresh = useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);
  const canReadBalance =
    wallet.connected && wallet.address && wallet.chainId === ARC_CHAIN_ID;

  useEffect(() => {
    if (!canReadBalance) {
      return;
    }

    let isCurrentRequest = true;
    const address = wallet.address as string;

    getArcUsdcBalance(address)
      .then((balance) => {
        if (!isCurrentRequest) {
          return;
        }

        setBalanceState({
          status: "ready",
          balance,
          formattedBalance: formatUSDCFromMinorUnits(balance),
          error: null,
          address,
        });
      })
      .catch((error: unknown) => {
        if (!isCurrentRequest) {
          return;
        }

        setBalanceState({
          status: "error",
          balance: null,
          formattedBalance: "0",
          error: getBalanceErrorMessage(error),
          address,
        });
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [canReadBalance, refreshVersion, wallet.address]);

  if (!wallet.connected || !wallet.address) {
    return { ...idleBalanceState, refresh };
  }

  if (wallet.chainId !== ARC_CHAIN_ID) {
    return {
      status: "error",
      balance: null,
      formattedBalance: "0",
      error: "Wallet is not on Arc Testnet.",
      refresh,
    };
  }

  if (balanceState.address !== wallet.address) {
    return {
      status: "loading",
      balance: null,
      formattedBalance: "0",
      error: null,
      refresh,
    };
  }

  return { ...balanceState, refresh };
}
