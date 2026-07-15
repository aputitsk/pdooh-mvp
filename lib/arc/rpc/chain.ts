import type { Chain } from "viem";

import {
  ARC_CHAIN_ID,
  ARC_CHAIN_NAME,
  ARC_EXPLORER_URL,
  ARC_NATIVE_CURRENCY_SYMBOL,
} from "../arcConstants";
import { ARC_NETWORK_METADATA_RPC_URLS } from "./config";

export const arcTestnetChain = {
  id: ARC_CHAIN_ID,
  name: ARC_CHAIN_NAME,
  nativeCurrency: {
    name: ARC_NATIVE_CURRENCY_SYMBOL,
    symbol: ARC_NATIVE_CURRENCY_SYMBOL,
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ARC_NETWORK_METADATA_RPC_URLS,
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: ARC_EXPLORER_URL,
    },
  },
  testnet: true,
} as const satisfies Chain;
