// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createFinalizedAuctionResultsFromWinnersSnapshot, type FinalizedWinnerResult } from "./finalizedWinnerResults.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createPendingSettlementRecord, type SettlementRecord } from "./settlementRecords.ts";

export type AccountingAuctionSnapshot = {
  phase: string;
  cycleId: number | string;
  chainId: number;
  escrowAddress: `0x${string}`;
  slotIds: readonly string[];
  winners: readonly FinalizedWinnerResult[];
  winnerBidAmounts: readonly number[];
  winnerAdvertiserAddresses: readonly (`0x${string}` | null)[];
};

export type CreatePendingSettlementRecordsParams = {
  snapshot: AccountingAuctionSnapshot;
  nowIso: string;
};

export function createPendingSettlementRecords(
  params: CreatePendingSettlementRecordsParams
): SettlementRecord[] {
  const finalizedResults =
    createFinalizedAuctionResultsFromWinnersSnapshot(params.snapshot);

  return finalizedResults.map((result) =>
    createPendingSettlementRecord(result, params.nowIso)
  );
}
