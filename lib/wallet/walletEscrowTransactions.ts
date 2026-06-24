import {
  depositArcUsdcToEscrow,
  type ArcEscrowDepositLifecycle,
  type ArcEscrowDepositResult,
} from "@/lib/arc/arcEscrowAdapter";
import { parseUSDCToMinorUnits } from "@/lib/money/usdc";

export type WalletEscrowDepositLifecycle = ArcEscrowDepositLifecycle;
export type WalletEscrowDepositResult = ArcEscrowDepositResult;

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
