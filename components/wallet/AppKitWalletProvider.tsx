"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
} from "@reown/appkit/react";
import { type ReactNode, useEffect } from "react";
import { WagmiProvider, type Config } from "wagmi";

import { arcWagmiAdapter } from "@/lib/arc/arcAppKitConfig";
import {
  resetArcWalletFromAppKit,
  syncArcWalletFromAppKit,
  type BrowserWalletProvider,
} from "@/lib/arc/arcWalletAdapter";
import { arcAppKitModal } from "./arcAppKitClient";

const queryClient = new QueryClient();

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
        <AppKitWalletBridge />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
