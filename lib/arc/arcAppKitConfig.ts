import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain, mainnet } from "@reown/appkit/networks";

import { ARC_CHAIN_ID } from "./arcConstants";
import { arcTestnetChain } from "./rpc/chain";
import { ARC_NETWORK_METADATA_RPC_URLS } from "./rpc/config";

export const arcAppKitProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "http://localhost:3000";

export const arcAppKitNetwork = defineChain({
  id: arcTestnetChain.id,
  caipNetworkId: `eip155:${ARC_CHAIN_ID}`,
  chainNamespace: "eip155",
  name: arcTestnetChain.name,
  nativeCurrency: arcTestnetChain.nativeCurrency,
  rpcUrls: arcTestnetChain.rpcUrls,
  blockExplorers: arcTestnetChain.blockExplorers,
  testnet: arcTestnetChain.testnet,
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
        [`eip155:${ARC_CHAIN_ID}`]: ARC_NETWORK_METADATA_RPC_URLS.map(
          (url) => ({ url })
        ),
      },
    })
  : null;

export function isArcAppKitConfigured() {
  return Boolean(arcAppKitProjectId && arcWagmiAdapter);
}
