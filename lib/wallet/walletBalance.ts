"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { ARC_CHAIN_ID } from "@/lib/arc/arcConstants";
import { getArcUsdcBalance } from "@/lib/arc/arcBalanceAdapter";
import { normalizeArcReadError } from "@/lib/arc/arcReadErrors";
import {
  formatUSDCFromMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";
import { getArcWalletState } from "@/lib/arc/arcWalletAdapter";
import { subscribeToWalletChanges } from "./walletEvents";
import {
  createWalletSnapshot,
  getServerWalletSnapshot,
  parseWalletSnapshot,
} from "./walletSnapshot";

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
function getWalletSnapshot() {
  return createWalletSnapshot(getArcWalletState());
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

        const normalizedError = normalizeArcReadError(error);

        setBalanceState((previousState) => {
          const previousBalance =
            previousState.address === address ? previousState.balance : null;

          return {
            status: "error",
            balance: previousBalance,
            formattedBalance:
              previousBalance === null
                ? "0"
                : formatUSDCFromMinorUnits(previousBalance),
            error: normalizedError.message,
            address,
          };
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
