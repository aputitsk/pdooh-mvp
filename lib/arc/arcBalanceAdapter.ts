import { erc20Abi, isAddress } from "viem";

import {
  ARC_USDC_CONTRACT_ADDRESS,
} from "./arcConstants";
import { arcPublicClient } from "./rpc/publicClient";
import { createInFlightRequestDedupe } from "./inFlightRequestDedupe";
import type { ArcBalancePort } from "./arcPorts";
import type { UsdcMinorUnits } from "@/lib/money/usdc";

const runDedupedWalletBalanceRead =
  createInFlightRequestDedupe<UsdcMinorUnits>();

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

    return runDedupedWalletBalanceRead(address.toLowerCase(), async () => {
      const balance = await arcPublicClient.readContract({
        address: ARC_USDC_CONTRACT_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });

      return toSafeUsdcMinorUnits(balance);
    });
  },
};

export function getArcUsdcBalance(address: string) {
  return arcBalancePort.getUsdcBalance(address);
}
