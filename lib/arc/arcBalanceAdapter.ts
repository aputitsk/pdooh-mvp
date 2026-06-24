import { createPublicClient, erc20Abi, http, isAddress } from "viem";
import type { Chain } from "viem";

import {
  ARC_CHAIN_ID,
  ARC_CHAIN_NAME,
  ARC_EXPLORER_URL,
  ARC_NATIVE_CURRENCY_SYMBOL,
  ARC_RPC_URL,
  ARC_USDC_CONTRACT_ADDRESS,
} from "./arcConstants";
import type { ArcBalancePort } from "./arcPorts";
import type { UsdcMinorUnits } from "@/lib/money/usdc";

const arcTestnetChain = {
  id: ARC_CHAIN_ID,
  name: ARC_CHAIN_NAME,
  nativeCurrency: {
    name: ARC_NATIVE_CURRENCY_SYMBOL,
    symbol: ARC_NATIVE_CURRENCY_SYMBOL,
    decimals: 18,
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
} as const satisfies Chain;

const arcPublicClient = createPublicClient({
  chain: arcTestnetChain,
  transport: http(ARC_RPC_URL),
});

function toSafeUsdcMinorUnits(balance: bigint): UsdcMinorUnits {
  if (balance < BigInt(0)) {
    throw new RangeError("USDC balance cannot be negative.");
  }

  if (balance > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("USDC balance exceeds safe integer range.");
  }

  return Number(balance);
}

export const arcBalancePort: ArcBalancePort = {
  async getUsdcBalance(address) {
    if (!isAddress(address)) {
      throw new Error("Wallet address is not a valid EVM address.");
    }

    const balance = await arcPublicClient.readContract({
      address: ARC_USDC_CONTRACT_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    });

    return toSafeUsdcMinorUnits(balance);
  },
};

export function getArcUsdcBalance(address: string) {
  return arcBalancePort.getUsdcBalance(address);
}
