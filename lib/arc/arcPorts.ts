import type { UsdcMinorUnits } from "@/lib/money/usdc";
import type { WalletState } from "@/lib/wallet";

export type ArcWalletPort = {
  connect: () => Promise<WalletState>;
  disconnect: () => Promise<void>;
  getState: () => Promise<WalletState>;
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
