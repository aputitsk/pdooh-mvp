"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
  useAppKitState,
  useDisconnect,
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
import {
  getArcNetworkSwitchDiagnostics,
  withArcSwitchTimeout,
} from "@/lib/wallet/arcNetworkSwitchDiagnostics";
import { setWalletFlowNotice } from "@/lib/wallet/walletFlowNoticeState";
import { arcAppKitModal } from "./arcAppKitClient";

const queryClient = new QueryClient();
const AUTO_SWITCH_CONNECTION_WINDOW_MS = 5 * 60 * 1000;
const MOBILE_HANDOFF_RESET_DELAY_MS = 1500;

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
  const chainIdRef = useRef(chainId);

  useEffect(() => {
    switchChainAsyncRef.current = switchChainAsync;
  }, [switchChainAsync]);

  useEffect(() => {
    chainIdRef.current = chainId;
  }, [chainId]);

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

    void (async () => {
      const diagnostics = await getArcNetworkSwitchDiagnostics({
        chainIdBefore: chainId,
        connector: account.connector,
      });

      if (!diagnostics.isWalletConnect) {
        try {
          await switchChainAsyncRef.current({ chainId: arcAppKitNetwork.id });

          if (isCurrentSwitch) {
            clearArcNetworkSwitchState();
          }
        } catch (error) {
          if (isCurrentSwitch) {
            setArcNetworkSwitchError(error);
          }
        }

        return;
      }

      if (diagnostics.sessionIncludesArc === false) {
        setArcNetworkSwitchError(
          new Error("Arc Testnet is not included in this WalletConnect session."),
          diagnostics
        );
        return;
      }

      try {
        await withArcSwitchTimeout(
          switchChainAsyncRef.current({ chainId: arcAppKitNetwork.id })
        );

        if (isCurrentSwitch && chainIdRef.current === arcAppKitNetwork.id) {
          clearArcNetworkSwitchState();
        }
      } catch (error) {
        if (isCurrentSwitch) {
          setArcNetworkSwitchError(error, diagnostics);
        }
      }
    })();

    return () => {
      isCurrentSwitch = false;
    };
  }, [
    account.address,
    account.connector,
    account.connector?.id,
    account.connector?.uid,
    account.isConnected,
    chainId,
  ]);

  return null;
}

function AppKitAccountChangeDisconnect() {
  const account = useAccount();
  const { disconnect } = useDisconnect();
  const previousAddressRef = useRef<string | null>(null);
  const isDisconnectingRef = useRef(false);

  useEffect(() => {
    const nextAddress = account.address?.toLowerCase() ?? null;

    if (!account.isConnected) {
      if (!isDisconnectingRef.current) {
        previousAddressRef.current = null;
      }
      return;
    }

    if (!nextAddress) {
      return;
    }

    if (!previousAddressRef.current) {
      previousAddressRef.current = nextAddress;
      return;
    }

    if (previousAddressRef.current === nextAddress || isDisconnectingRef.current) {
      return;
    }

    isDisconnectingRef.current = true;
    setWalletFlowNotice("Wallet account changed. Please reconnect.");
    clearArcNetworkConnectionAttempt();
    clearArcNetworkSwitchState();

    void disconnect({ namespace: "eip155" }).finally(() => {
      resetArcWalletFromAppKit();
      previousAddressRef.current = null;
      isDisconnectingRef.current = false;
    });
  }, [account.address, account.isConnected, disconnect]);

  return null;
}

function AppKitMobileHandoffReset() {
  const { address, isConnected } = useAppKitAccount({
    namespace: "eip155",
  });
  const appKitState = useAppKitState();

  useEffect(() => {
    if (isConnected || address || !appKitState.connectingWallet) {
      return;
    }

    let resetTimeoutId: ReturnType<typeof setTimeout> | null = null;

    function resetStaleMobileHandoff() {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (resetTimeoutId) {
        clearTimeout(resetTimeoutId);
      }

      resetTimeoutId = setTimeout(() => {
        if (!isConnected && !address) {
          arcAppKitModal?.resetConnectingWallet();
          arcAppKitModal?.resetWalletConnectUri();
          clearArcNetworkConnectionAttempt();
        }
      }, MOBILE_HANDOFF_RESET_DELAY_MS);
    }

    window.addEventListener("focus", resetStaleMobileHandoff);
    window.addEventListener("pageshow", resetStaleMobileHandoff);
    document.addEventListener("visibilitychange", resetStaleMobileHandoff);
    resetStaleMobileHandoff();

    return () => {
      if (resetTimeoutId) {
        clearTimeout(resetTimeoutId);
      }

      window.removeEventListener("focus", resetStaleMobileHandoff);
      window.removeEventListener("pageshow", resetStaleMobileHandoff);
      document.removeEventListener("visibilitychange", resetStaleMobileHandoff);
    };
  }, [address, appKitState.connectingWallet, isConnected]);

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
        <AppKitAccountChangeDisconnect />
        <AppKitMobileHandoffReset />
        <AppKitWalletBridge />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
