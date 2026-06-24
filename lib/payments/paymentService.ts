import {
  depositWalletUsdcToEscrow,
  sendWalletUsdcToTreasury,
} from "@/lib/wallet";

import type {
  EscrowDepositLifecycle,
  EscrowDepositResult,
  PaymentTransactionHash,
  TreasuryPaymentLifecycle,
} from "./paymentTypes";

export async function sendTreasuryPayment(
  amount: string,
  lifecycle: TreasuryPaymentLifecycle = {}
): Promise<PaymentTransactionHash> {
  return sendWalletUsdcToTreasury(amount, lifecycle);
}

export async function depositEscrowFunds(
  amount: string,
  lifecycle: EscrowDepositLifecycle = {}
): Promise<EscrowDepositResult> {
  return depositWalletUsdcToEscrow(amount, lifecycle);
}

export type {
  EscrowDepositLifecycle,
  EscrowDepositResult,
  PaymentTransactionHash,
  TreasuryPaymentLifecycle,
} from "./paymentTypes";
