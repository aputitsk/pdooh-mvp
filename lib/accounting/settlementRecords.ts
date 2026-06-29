import { keccak256, toBytes } from "viem";

import type { SignedBidAuthorization } from "@/lib/auction";

const SETTLEMENT_ID_VERSION = "pdooh-settlement-v1";

type HexAddress = `0x${string}`;

export type SettlementStatus =
  | "pending"
  | "processing"
  | "settled"
  | "failed";

export type FinalizedAuctionResult = {
  chainId: number;
  escrowAddress: HexAddress;
  treasuryAddress: HexAddress;
  usdcAddress: HexAddress;
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
  status: SettlementStatus;
  result: FinalizedAuctionResult;
  createdAt: string;
  updatedAt: string;
  txHash?: HexAddress;
  failureReason?: string;
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
  const identity = JSON.stringify([
    SETTLEMENT_ID_VERSION,
    result.chainId,
    normalizeAddress(result.escrowAddress),
    result.cycleId,
    result.slotId,
    normalizeAddress(result.advertiserAddress),
    result.amountMinorUnits.toString(),
  ]);

  return keccak256(toBytes(identity));
}

export function createPendingSettlementRecord(
  result: FinalizedAuctionResult,
  nowIso: string
): SettlementRecord {
  assertPositiveMinorUnits(result.amountMinorUnits);
  assertNonEmptyString(nowIso, "nowIso");

  return {
    settlementId: createSettlementId(result),
    status: "pending",
    result: cloneFinalizedAuctionResult(result),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function markSettlementProcessing(
  record: SettlementRecord,
  nowIso: string
): SettlementRecord {
  if (record.status !== "pending" && record.status !== "failed") {
    throw new Error("Only pending or failed settlements can be processed.");
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
    ...(transactionHash ? { txHash: transactionHash } : {}),
    failureReason: undefined,
  };
}

export function markSettlementFailed(
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
    status: "failed",
    updatedAt: nowIso,
    failureReason,
  };
}
