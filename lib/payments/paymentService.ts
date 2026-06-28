import {
  depositWalletUsdcToEscrow,
  sendWalletUsdcToTreasury,
  withdrawWalletUsdcFromEscrow,
} from "@/lib/wallet";

import type {
  EscrowDepositLifecycle,
  EscrowDepositResult,
  EscrowWithdrawLifecycle,
  EscrowWithdrawResult,
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

export async function withdrawEscrowFunds(
  amount: string,
  lifecycle: EscrowWithdrawLifecycle = {}
): Promise<EscrowWithdrawResult> {
  return withdrawWalletUsdcFromEscrow(amount, lifecycle);
}

export type {
  EscrowDepositLifecycle,
  EscrowDepositResult,
  EscrowWithdrawLifecycle,
  EscrowWithdrawResult,
  PaymentTransactionHash,
  TreasuryPaymentLifecycle,
} from "./paymentTypes";
