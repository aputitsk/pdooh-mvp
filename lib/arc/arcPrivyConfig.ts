import type { PrivyClientConfig } from "@privy-io/react-auth";

import { arcTestnetChain } from "./rpc/chain";

export const arcPrivyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? "";

export const arcPrivyChain = arcTestnetChain;

export const arcPrivyConfig = {
  loginMethods: ["email"],
  externalWallets: {
    disableAllExternalWallets: true,
    walletConnect: {
      enabled: false,
    },
  },
  supportedChains: [arcPrivyChain],
  defaultChain: arcPrivyChain,
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
    showWalletUIs: false,
  },
} satisfies PrivyClientConfig;

export function isArcPrivyConfigured() {
  return Boolean(arcPrivyAppId);
}
