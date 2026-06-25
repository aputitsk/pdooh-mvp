// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createFinalizedAuctionResult } from "./finalizedAuctionResults.ts";
import type { FinalizedAuctionResult } from "./settlementRecords.ts";

export type FinalizedWinnerResult = {
  name: string;
  businessName: string;
};

type CreateFinalizedAuctionResultsFromWinnersSnapshotParams = {
  phase: string;
  cycleId: number | string;
  chainId: number;
  escrowAddress: `0x${string}`;
  slotIds: readonly string[];
  winners: readonly FinalizedWinnerResult[];
  winnerBidAmounts: readonly number[];
  winnerAdvertiserAddresses: readonly (`0x${string}` | null)[];
};

export function createFinalizedAuctionResultsFromWinnersSnapshot(
  params: CreateFinalizedAuctionResultsFromWinnersSnapshotParams
): FinalizedAuctionResult[] {
  if (params.phase !== "locked" && params.phase !== "live") {
    return [];
  }

  const cycleId = String(params.cycleId);
  const results: FinalizedAuctionResult[] = [];

  params.slotIds.forEach((slotId, index) => {
    const winner = params.winners[index];

    if (
      !slotId ||
      slotId.trim().length === 0 ||
      !winner ||
      winner.businessName === "Demo Bot"
    ) {
      return;
    }

    const result = createFinalizedAuctionResult({
      chainId: params.chainId,
      escrowAddress: params.escrowAddress,
      cycleId,
      slotId,
      advertiserAddress: params.winnerAdvertiserAddresses[index] ?? null,
      advertisementName: winner.name,
      amountMinorUnits: params.winnerBidAmounts[index] ?? 0,
    });

    if (result) {
      results.push(result);
    }
  });

  return results;
}
