import type { UsdcMinorUnits } from "@/lib/money/usdc";
import type { ArcWalletState } from "./arcWalletTypes";

export type ArcWalletPort = {
  connect: () => Promise<ArcWalletState>;
  disconnect: () => Promise<void>;
  getState: () => Promise<ArcWalletState>;
};

export type ArcBalancePort = {
  getUsdcBalance: (address: string) => Promise<UsdcMinorUnits>;
};

export type ArcPaymentRequest = {
  from: string;
  to: string;
  amount: UsdcMinorUnits;
};

export type ArcPaymentResult = {
  transactionHash: string;
  explorerUrl: string;
};

export type ArcPaymentPort = {
  sendUsdc: (request: ArcPaymentRequest) => Promise<ArcPaymentResult>;
};
