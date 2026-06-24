import { formatUSDCFromMinorUnits } from "@/lib/money/usdc";

import { ARC_EXPLORER_URL } from "./arcConstants";
import type { ArcBalancePort, ArcPaymentPort, ArcWalletPort } from "./arcPorts";
import {
  connectArcWallet,
  disconnectArcWallet,
  getArcWalletState,
} from "./arcWalletAdapter";

function createMockTransactionHash(seed: string) {
  let hash = "";

  for (let index = 0; index < seed.length; index += 1) {
    hash += seed.charCodeAt(index).toString(16).padStart(2, "0");
  }

  return `0x${hash.padEnd(64, "0").slice(0, 64)}`;
}

export const mockArcWalletPort: ArcWalletPort = {
  async connect() {
    void connectArcWallet().catch(() => undefined);

    return getArcWalletState();
  },

  async disconnect() {
    disconnectArcWallet();
  },

  async getState() {
    return getArcWalletState();
  },
};

export const mockArcBalancePort: ArcBalancePort = {
  async getUsdcBalance() {
    return 0;
  },
};

export const mockArcPaymentPort: ArcPaymentPort = {
  async sendUsdc(request) {
    if (request.amount <= 0) {
      throw new Error("USDC payment amount must be greater than zero.");
    }

    const amount = formatUSDCFromMinorUnits(request.amount);
    const transactionHash = createMockTransactionHash(
      `${request.from}:${request.to}:${amount}`
    );

    return {
      transactionHash,
      explorerUrl: `${ARC_EXPLORER_URL}/tx/${transactionHash}`,
    };
  },
};
