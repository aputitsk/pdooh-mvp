import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain, mainnet } from "@reown/appkit/networks";

import {
  ARC_CHAIN_ID,
  ARC_CHAIN_NAME,
  ARC_EXPLORER_URL,
  ARC_NATIVE_CURRENCY_SYMBOL,
  ARC_RPC_URL,
} from "./arcConstants";

export const arcAppKitProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "http://localhost:3000";

export const arcAppKitNetwork = defineChain({
  id: ARC_CHAIN_ID,
  caipNetworkId: `eip155:${ARC_CHAIN_ID}`,
  chainNamespace: "eip155",
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
});

export const arcAppKitNetworks = [
  arcAppKitNetwork,
  mainnet,
] as [typeof arcAppKitNetwork, typeof mainnet];

export const arcAppKitMetadata = {
  name: "pDOOH",
  description: "Private digital screen ad auctions with Arc Testnet settlement.",
  url: appUrl,
  icons: [],
};

export const arcWagmiAdapter = arcAppKitProjectId
  ? new WagmiAdapter({
      networks: arcAppKitNetworks,
      projectId: arcAppKitProjectId,
      ssr: true,
      customRpcUrls: {
        [`eip155:${ARC_CHAIN_ID}`]: [{ url: ARC_RPC_URL }],
      },
    })
  : null;

export function isArcAppKitConfigured() {
  return Boolean(arcAppKitProjectId && arcWagmiAdapter);
}
