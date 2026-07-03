// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createFinalizedAuctionResultsFromWinnersSnapshot, type FinalizedWinnerResult } from "./finalizedWinnerResults.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createPendingSettlementRecord, type SettlementRecord } from "./settlementRecords.ts";
import type { MarketId, SignedBidAuthorization, SiteId } from "@/lib/auction";

export type AccountingAuctionSnapshot = {
  phase: string;
  cycleId: number | string;
  chainId: number;
  escrowAddress: `0x${string}`;
  treasuryAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  marketId: MarketId;
  siteId: SiteId;
  slotIds: readonly string[];
  winners: readonly FinalizedWinnerResult[];
  winnerBidAmounts: readonly number[];
  winnerAdvertiserAddresses: readonly (`0x${string}` | null)[];
  winnerBidAuthorizations: readonly (SignedBidAuthorization | null)[];
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
