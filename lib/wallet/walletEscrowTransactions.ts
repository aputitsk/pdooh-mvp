import {
  depositArcUsdcToEscrow,
  withdrawArcUsdcFromEscrow,
  type ArcEscrowDepositLifecycle,
  type ArcEscrowDepositResult,
  type ArcEscrowWithdrawLifecycle,
  type ArcEscrowWithdrawResult,
} from "@/lib/arc/arcEscrowAdapter";
import { parseUSDCToMinorUnits } from "@/lib/money/usdc";

export type WalletEscrowDepositLifecycle = ArcEscrowDepositLifecycle;
export type WalletEscrowDepositResult = ArcEscrowDepositResult;
export type WalletEscrowWithdrawLifecycle = ArcEscrowWithdrawLifecycle;
export type WalletEscrowWithdrawResult = ArcEscrowWithdrawResult;

export async function depositWalletUsdcToEscrow(
  amountInput: string,
  lifecycle: WalletEscrowDepositLifecycle = {}
): Promise<WalletEscrowDepositResult> {
  const amount = parseUSDCToMinorUnits(amountInput);

  if (amount <= 0) {
    throw new Error("Enter an escrow deposit amount greater than zero.");
  }

  return depositArcUsdcToEscrow(amount, lifecycle);
}

export async function withdrawWalletUsdcFromEscrow(
  amountInput: string,
  lifecycle: WalletEscrowWithdrawLifecycle = {}
): Promise<WalletEscrowWithdrawResult> {
  const amount = parseUSDCToMinorUnits(amountInput);

  if (amount <= 0) {
    throw new Error("Enter an escrow withdraw amount greater than zero.");
  }

  return withdrawArcUsdcFromEscrow(amount, lifecycle);
}
