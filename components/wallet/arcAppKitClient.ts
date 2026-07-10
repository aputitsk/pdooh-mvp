"use client";

import { createAppKit } from "@reown/appkit/react";

import {
  arcAppKitMetadata,
  arcAppKitNetwork,
  arcAppKitNetworks,
  arcAppKitProjectId,
  arcWagmiAdapter,
} from "@/lib/arc/arcAppKitConfig";

const appKitMetadata = {
  ...arcAppKitMetadata,
  url:
    typeof window === "undefined"
      ? arcAppKitMetadata.url
      : window.location.origin,
};

export const arcAppKitModal =
  arcWagmiAdapter && arcAppKitProjectId
    ? createAppKit({
        adapters: [arcWagmiAdapter],
        networks: arcAppKitNetworks,
        defaultNetwork: arcAppKitNetwork,
        projectId: arcAppKitProjectId,
        metadata: appKitMetadata,
        defaultAccountTypes: {
          eip155: "eoa",
        },
        enableEmbedded: false,
        enableNetworkSwitch: true,
        features: {
          allWallets: true,
          analytics: true,
          connectorTypeOrder: [
            "injected",
            "recent",
            "walletConnect",
            "featured",
            "recommended",
          ],
          connectMethodsOrder: ["wallet"],
          email: false,
          history: false,
          onramp: false,
          pay: false,
          receive: false,
          send: false,
          socials: false,
          swaps: false,
        },
      })
    : null;
