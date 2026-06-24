import type { Hash } from "viem";

import {
  transferArcUsdcToTreasury,
  waitForArcTransaction,
} from "@/lib/arc/arcTransactionAdapter";
import { parseUSDCToMinorUnits } from "@/lib/money/usdc";

export type WalletTransactionLifecycle = {
  onWaitingForWallet?: () => void;
  onPending?: (transactionHash: Hash) => void;
};

export async function sendWalletUsdcToTreasury(
  amountInput: string,
  lifecycle: WalletTransactionLifecycle = {}
): Promise<Hash> {
  const amount = parseUSDCToMinorUnits(amountInput);

  if (amount <= 0) {
    throw new Error("Enter a USDC amount greater than zero.");
  }

  const transactionHash = await transferArcUsdcToTreasury(
    amount,
    lifecycle.onWaitingForWallet
  );

  lifecycle.onPending?.(transactionHash);
  await waitForArcTransaction(transactionHash);

  return transactionHash;
}
