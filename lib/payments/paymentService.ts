import { sendWalletUsdcToTreasury } from "@/lib/wallet";

import type {
  PaymentTransactionHash,
  TreasuryPaymentLifecycle,
} from "./paymentTypes";

export async function sendTreasuryPayment(
  amount: string,
  lifecycle: TreasuryPaymentLifecycle = {}
): Promise<PaymentTransactionHash> {
  return sendWalletUsdcToTreasury(amount, lifecycle);
}

export type {
  PaymentTransactionHash,
  TreasuryPaymentLifecycle,
} from "./paymentTypes";
