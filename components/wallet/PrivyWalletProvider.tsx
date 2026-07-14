"use client";

import {
  PrivyProvider,
  type ConnectedWallet,
  getEmbeddedConnectedWallet,
  useCreateWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { arcPrivyAppId, arcPrivyConfig } from "@/lib/arc/arcPrivyConfig";
import {
  resetArcWallet,
  syncArcWallet,
  type BrowserWalletProvider,
} from "@/lib/arc/arcWalletAdapter";
import { setWalletFlowNotice } from "@/lib/wallet/walletFlowNoticeState";

const WALLET_SYNC_RETRY_LIMIT = 30;
const WALLET_SYNC_RETRY_DELAY_MS = 500;

function isPrivyEmbeddedEvmWallet(wallet: ConnectedWallet) {
  const walletClientType = String(wallet.walletClientType);
  const connectorType = String(wallet.connectorType);

  return (
    wallet.type === "ethereum" &&
    !wallet.imported &&
    (connectorType === "embedded" ||
      walletClientType === "privy" ||
      walletClientType === "privy-v2")
  );
}

export function selectPrivyEmbeddedEvmWallet(wallets: ConnectedWallet[]) {
  return (
    getEmbeddedConnectedWallet(wallets) ??
    wallets.find(isPrivyEmbeddedEvmWallet) ??
    null
  );
}

function getPrivyErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as { message?: unknown };

    if (typeof candidate.message === "string" && candidate.message) {
      return candidate.message;
    }
  }

  return "Unknown Privy error.";
}

function isExistingEmbeddedWalletError(error: unknown) {
  return /already has an embedded wallet/i.test(getPrivyErrorMessage(error));
}

function PrivyWalletBridge() {
  const { authenticated, ready, user } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const [retryTick, setRetryTick] = useState(0);
  const retryAttemptRef = useRef(0);
  const createWalletAttemptedForUserRef = useRef<string | null>(null);
  const createWalletInFlightRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const userId = user?.id ?? null;

    if (userIdRef.current !== userId) {
      retryAttemptRef.current = 0;
      userIdRef.current = userId;
    }

    function queueRetry() {
      if (retryAttemptRef.current >= WALLET_SYNC_RETRY_LIMIT) {
        setWalletFlowNotice(
          "Email login succeeded, but the embedded wallet did not become available. Use Reset email login and try again."
        );
        return;
      }

      retryAttemptRef.current += 1;
      retryTimeoutId = setTimeout(() => {
        if (!isCancelled) {
          setRetryTick((current) => current + 1);
        }
      }, WALLET_SYNC_RETRY_DELAY_MS);
    }

    function createEmbeddedWalletOnce() {
      if (
        createWalletInFlightRef.current ||
        !user?.id ||
        createWalletAttemptedForUserRef.current === user.id
      ) {
        return;
      }

      createWalletInFlightRef.current = true;
      createWalletAttemptedForUserRef.current = user.id;

      void createWallet()
        .then(() => {
          queueRetry();
        })
        .catch((error: unknown) => {
          if (isExistingEmbeddedWalletError(error)) {
            queueRetry();
            return;
          }

          setWalletFlowNotice(
            `Email wallet creation failed: ${getPrivyErrorMessage(error)}`
          );
          queueRetry();
        })
        .finally(() => {
          createWalletInFlightRef.current = false;
        });
    }

    if (!ready) {
      return () => {
        isCancelled = true;
        if (retryTimeoutId) {
          clearTimeout(retryTimeoutId);
        }
      };
    }

    if (!authenticated) {
      retryAttemptRef.current = 0;
      createWalletAttemptedForUserRef.current = null;
      createWalletInFlightRef.current = false;
      resetArcWallet("privy");
      return () => {
        isCancelled = true;
        if (retryTimeoutId) {
          clearTimeout(retryTimeoutId);
        }
      };
    }

    if (!user) {
      queueRetry();
      return () => {
        isCancelled = true;
        if (retryTimeoutId) {
          clearTimeout(retryTimeoutId);
        }
      };
    }

    const wallet = selectPrivyEmbeddedEvmWallet(wallets);

    if (!wallet) {
      createEmbeddedWalletOnce();
      queueRetry();

      if (walletsReady) {
        resetArcWallet("privy");
      }

      return () => {
        isCancelled = true;
        if (retryTimeoutId) {
          clearTimeout(retryTimeoutId);
        }
      };
    }

    void wallet
      .getEthereumProvider()
      .then((provider) => {
        if (isCancelled) {
          return;
        }

        return syncArcWallet({
          source: "privy",
          address: wallet.address,
          chainId: wallet.chainId,
          provider: provider as BrowserWalletProvider,
        }).then(() => {
          retryAttemptRef.current = 0;
        });
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setWalletFlowNotice(
            `Email wallet provider failed: ${getPrivyErrorMessage(error)}`
          );
          queueRetry();
          resetArcWallet("privy");
        }
      });

    return () => {
      isCancelled = true;
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
    };
  }, [
    authenticated,
    createWallet,
    ready,
    retryTick,
    user,
    user?.id,
    wallets,
    walletsReady,
  ]);

  return null;
}

export default function PrivyWalletProvider({
  children,
}: {
  children: ReactNode;
}) {
  if (!arcPrivyAppId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider appId={arcPrivyAppId} config={arcPrivyConfig}>
      <PrivyWalletBridge />
      {children}
    </PrivyProvider>
  );
}
