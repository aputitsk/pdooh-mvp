"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
} from "@reown/appkit/react";
import { type ReactNode, useEffect, useRef } from "react";
import {
  WagmiProvider,
  type Config,
  useAccount,
  useChainId,
  useSwitchChain,
} from "wagmi";

import {
  arcAppKitNetwork,
  arcWagmiAdapter,
} from "@/lib/arc/arcAppKitConfig";
import {
  resetArcWalletFromAppKit,
  syncArcWalletFromAppKit,
  type BrowserWalletProvider,
} from "@/lib/arc/arcWalletAdapter";
import {
  clearArcNetworkSwitchState,
  clearArcNetworkConnectionAttempt,
  getArcNetworkConnectionAttempt,
  consumeArcNetworkConnectionAttempt,
  setArcNetworkSwitchError,
  setArcNetworkSwitching,
} from "@/lib/wallet/arcNetworkSwitchState";
import { arcAppKitModal } from "./arcAppKitClient";

const queryClient = new QueryClient();
const AUTO_SWITCH_CONNECTION_WINDOW_MS = 5 * 60 * 1000;

function AppKitWalletBridge() {
  const { address, isConnected, status } = useAppKitAccount({
    namespace: "eip155",
  });
  const { chainId } = useAppKitNetwork();
  const { walletProvider } =
    useAppKitProvider<BrowserWalletProvider>("eip155");

  useEffect(() => {
    let isCancelled = false;

    if (
      !isConnected ||
      !address ||
      !walletProvider ||
      status === "disconnected"
    ) {
      resetArcWalletFromAppKit();
      return () => {
        isCancelled = true;
      };
    }

    void syncArcWalletFromAppKit({
      address,
      chainId,
      provider: walletProvider,
    }).catch(() => {
      if (!isCancelled) {
        resetArcWalletFromAppKit();
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [address, chainId, isConnected, status, walletProvider]);

  return null;
}

function AppKitNetworkAutoSwitch() {
  const account = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const switchChainAsyncRef = useRef(switchChainAsync);
  const attemptedAutoSwitchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    switchChainAsyncRef.current = switchChainAsync;
  }, [switchChainAsync]);

  useEffect(() => {
    if (!account.isConnected || !account.address) {
      attemptedAutoSwitchKeyRef.current = null;
      clearArcNetworkSwitchState();
      return;
    }

    if (chainId === arcAppKitNetwork.id) {
      clearArcNetworkSwitchState();
      return;
    }

    const connectionAttempt = getArcNetworkConnectionAttempt();

    if (
      !connectionAttempt ||
      Date.now() - connectionAttempt.startedAtMs >
        AUTO_SWITCH_CONNECTION_WINDOW_MS
    ) {
      if (connectionAttempt) {
        clearArcNetworkConnectionAttempt();
      }
      return;
    }

    const autoSwitchKey = [
      connectionAttempt.id,
      account.address,
      account.connector?.uid ?? account.connector?.id ?? "unknown",
    ].join(":");

    if (attemptedAutoSwitchKeyRef.current === autoSwitchKey) {
      clearArcNetworkConnectionAttempt();
      return;
    }

    consumeArcNetworkConnectionAttempt();
    attemptedAutoSwitchKeyRef.current = autoSwitchKey;
    setArcNetworkSwitching();

    let isCurrentSwitch = true;

    void switchChainAsyncRef.current({ chainId: arcAppKitNetwork.id })
      .then(() => {
        if (isCurrentSwitch) {
          clearArcNetworkSwitchState();
        }
      })
      .catch((error: unknown) => {
        if (isCurrentSwitch) {
          setArcNetworkSwitchError(error);
        }
      });

    return () => {
      isCurrentSwitch = false;
    };
  }, [
    account.address,
    account.connector?.id,
    account.connector?.uid,
    account.isConnected,
    chainId,
  ]);

  return null;
}

export default function AppKitWalletProvider({
  children,
}: {
  children: ReactNode;
}) {
  if (!arcWagmiAdapter || !arcAppKitModal) {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={arcWagmiAdapter.wagmiConfig as Config}>
      <QueryClientProvider client={queryClient}>
        <AppKitNetworkAutoSwitch />
        <AppKitWalletBridge />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
