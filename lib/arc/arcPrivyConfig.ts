import type { PrivyClientConfig } from "@privy-io/react-auth";

import {
  ARC_CHAIN_ID,
  ARC_CHAIN_NAME,
  ARC_EXPLORER_URL,
  ARC_NATIVE_CURRENCY_SYMBOL,
  ARC_RPC_URL,
} from "./arcConstants";

export const arcPrivyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? "";

export const arcPrivyChain = {
  id: ARC_CHAIN_ID,
  name: ARC_CHAIN_NAME,
  nativeCurrency: {
    decimals: 18,
    name: ARC_NATIVE_CURRENCY_SYMBOL,
    symbol: ARC_NATIVE_CURRENCY_SYMBOL,
  },
  rpcUrls: {
    default: {
      http: [ARC_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: ARC_EXPLORER_URL,
    },
  },
  testnet: true,
};

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
