"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { ARC_CHAIN_ID } from "@/lib/arc/arcConstants";
import { getArcEscrowBalance } from "@/lib/arc/arcEscrowAdapter";
import { getArcWalletState } from "@/lib/arc/arcWalletAdapter";
import {
  formatUSDCFromMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";
import { subscribeToWalletChanges } from "./walletEvents";
import {
  createWalletSnapshot,
  getServerWalletSnapshot,
  parseWalletSnapshot,
} from "./walletSnapshot";

export type WalletEscrowBalanceState = {
  status: "idle" | "loading" | "ready" | "error";
  balance: UsdcMinorUnits | null;
  formattedBalance: string;
  error: string | null;
  updatedAtMs: number | null;
  refresh: () => void;
};

type InternalWalletEscrowBalanceState = Omit<
  WalletEscrowBalanceState,
  "refresh"
> & {
  address: string | null;
};

const idleBalanceState: InternalWalletEscrowBalanceState = {
  status: "idle",
  balance: null,
  formattedBalance: "0",
  error: null,
  address: null,
  updatedAtMs: null,
};
function getWalletSnapshot() {
  return createWalletSnapshot(getArcWalletState());
}

function getBalanceErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to read escrow balance.";
}

export function useWalletEscrowBalance(): WalletEscrowBalanceState {
  const walletSnapshot = useSyncExternalStore(
    subscribeToWalletChanges,
    getWalletSnapshot,
    getServerWalletSnapshot
  );
  const wallet = parseWalletSnapshot(walletSnapshot);
  const [balanceState, setBalanceState] =
    useState<InternalWalletEscrowBalanceState>(idleBalanceState);
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

    getArcEscrowBalance(address)
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
          updatedAtMs: Date.now(),
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
          updatedAtMs: null,
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
      updatedAtMs: null,
      refresh,
    };
  }

  if (balanceState.address !== wallet.address) {
    return {
      status: "loading",
      balance: null,
      formattedBalance: "0",
      error: null,
      updatedAtMs: null,
      refresh,
    };
  }

  return { ...balanceState, refresh };
}
