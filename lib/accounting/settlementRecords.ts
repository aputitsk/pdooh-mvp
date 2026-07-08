import { keccak256, toBytes } from "viem";

import type { MarketId, SignedBidAuthorization, SiteId } from "@/lib/auction";

export const SETTLEMENT_IDENTITY_VERSION_V2 = "pdooh-settlement-v2";

export type SettlementIdentityVersion =
  typeof SETTLEMENT_IDENTITY_VERSION_V2;

type HexAddress = `0x${string}`;

export type SettlementStatus =
  | "pending_playback"
  | "ready_to_settle"
  | "processing"
  | "settled"
  | "failed_retryable"
  | "failed_terminal";

type LegacySettlementStatus =
  | "pending"
  | "already_settled"
  | "cancelled"
  | "failed";

export type FinalizedAuctionResult = {
  chainId: number;
  escrowAddress: HexAddress;
  treasuryAddress: HexAddress;
  usdcAddress: HexAddress;
  marketId: MarketId;
  siteId: SiteId;
  cycleId: string;
  slotId: string;
  advertiserAddress: HexAddress;
  businessName: string;
  advertisementName: string;
  amountMinorUnits: bigint;
  bidAuthorization?: SignedBidAuthorization;
};

export type SettlementRecord = {
  settlementId: HexAddress;
  identityVersion: SettlementIdentityVersion;
  status: SettlementStatus;
  result: FinalizedAuctionResult;
  createdAt: string;
  updatedAt: string;
  txHash?: HexAddress;
  failureReason?: string;
};

export type StoredSettlementRecord = Omit<SettlementRecord, "status"> & {
  status: SettlementStatus | LegacySettlementStatus;
};

function normalizeAddress(value: HexAddress): HexAddress {
  return value.toLowerCase() as HexAddress;
}

function assertPositiveMinorUnits(value: bigint) {
  if (value <= BigInt(0)) {
    throw new RangeError("amountMinorUnits must be greater than zero.");
  }
}

function assertNonEmptyString(value: string, fieldName: string) {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
}

function cloneSignedBidAuthorization(
  bidAuthorization: SignedBidAuthorization | undefined
): SignedBidAuthorization | undefined {
  if (!bidAuthorization) {
    return undefined;
  }

  return {
    payload: { ...bidAuthorization.payload },
    signature: bidAuthorization.signature,
  };
}

function cloneFinalizedAuctionResult(
  result: FinalizedAuctionResult
): FinalizedAuctionResult {
  const clonedResult = { ...result };
  const bidAuthorization = cloneSignedBidAuthorization(result.bidAuthorization);

  if (bidAuthorization) {
    clonedResult.bidAuthorization = bidAuthorization;
  } else {
    delete clonedResult.bidAuthorization;
  }

  return clonedResult;
}

export function createSettlementId(
  result: FinalizedAuctionResult
): HexAddress {
  assertNonEmptyString(result.marketId, "marketId");
  assertNonEmptyString(result.siteId, "siteId");

  const identity = JSON.stringify([
    SETTLEMENT_IDENTITY_VERSION_V2,
    result.chainId,
    normalizeAddress(result.escrowAddress),
    result.marketId,
    result.siteId,
    result.cycleId,
    result.slotId,
    normalizeAddress(result.advertiserAddress),
    result.amountMinorUnits.toString(),
  ]);

  return keccak256(toBytes(identity));
}

export function isV2SettlementRecord(record: SettlementRecord): boolean {
  return (
    record.identityVersion === SETTLEMENT_IDENTITY_VERSION_V2 &&
    typeof record.result.marketId === "string" &&
    record.result.marketId.trim().length > 0 &&
    typeof record.result.siteId === "string" &&
    record.result.siteId.trim().length > 0
  );
}

export function createPendingSettlementRecord(
  result: FinalizedAuctionResult,
  nowIso: string
): SettlementRecord {
  assertPositiveMinorUnits(result.amountMinorUnits);
  assertNonEmptyString(nowIso, "nowIso");

  return {
    settlementId: createSettlementId(result),
    identityVersion: SETTLEMENT_IDENTITY_VERSION_V2,
    status: "pending_playback",
    result: cloneFinalizedAuctionResult(result),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function markSettlementReadyToSettle(
  record: SettlementRecord,
  nowIso: string
): SettlementRecord {
  if (
    record.status !== "pending_playback" &&
    record.status !== "processing"
  ) {
    throw new Error("Only pending playback or stale processing settlements can become ready.");
  }

  assertNonEmptyString(nowIso, "nowIso");

  return {
    ...record,
    status: "ready_to_settle",
    updatedAt: nowIso,
    failureReason: undefined,
  };
}

export function markSettlementProcessing(
  record: SettlementRecord,
  nowIso: string
): SettlementRecord {
  if (
    record.status !== "ready_to_settle" &&
    record.status !== "failed_retryable"
  ) {
    throw new Error("Only ready or retryable settlements can be processed.");
  }

  assertNonEmptyString(nowIso, "nowIso");

  return {
    ...record,
    status: "processing",
    updatedAt: nowIso,
    failureReason: undefined,
  };
}

export function markSettlementSettled(
  record: SettlementRecord,
  transactionHash: HexAddress | undefined,
  nowIso: string
): SettlementRecord {
  if (record.status !== "processing") {
    throw new Error("Only processing settlements can be settled.");
  }

  assertNonEmptyString(nowIso, "nowIso");

  return {
    ...record,
    status: "settled",
    updatedAt: nowIso,
    txHash: transactionHash,
    failureReason: undefined,
  };
}

export function markSettlementFailedTerminal(
  record: SettlementRecord,
  failureReason: string,
  nowIso: string
): SettlementRecord {
  if (record.status === "settled") {
    throw new Error("Settled settlements cannot fail.");
  }

  assertNonEmptyString(failureReason, "failureReason");
  assertNonEmptyString(nowIso, "nowIso");

  return {
    ...record,
    status: "failed_terminal",
    updatedAt: nowIso,
    txHash: undefined,
    failureReason,
  };
}

export function markSettlementFailedRetryable(
  record: SettlementRecord,
  failureReason: string,
  nowIso: string
): SettlementRecord {
  if (record.status !== "processing") {
    throw new Error("Only processing settlements can fail.");
  }

  assertNonEmptyString(failureReason, "failureReason");
  assertNonEmptyString(nowIso, "nowIso");

  return {
    ...record,
    status: "failed_retryable",
    updatedAt: nowIso,
    failureReason,
  };
}

export function normalizeStoredSettlementRecord(
  record: StoredSettlementRecord
): SettlementRecord {
  if (record.status === "pending") {
    return { ...record, status: "pending_playback" };
  }

  if (record.status === "already_settled") {
    return {
      ...record,
      status: "settled",
      txHash: undefined,
      failureReason: undefined,
    };
  }

  if (record.status === "cancelled") {
    return { ...record, status: "failed_terminal" };
  }

  if (record.status === "failed") {
    return {
      ...record,
      status: record.result.bidAuthorization
        ? "failed_retryable"
        : "failed_terminal",
    };
  }

  return record as SettlementRecord;
}
