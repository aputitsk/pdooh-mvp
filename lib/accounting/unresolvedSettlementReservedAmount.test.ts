import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createPendingSettlementRecord, markSettlementFailed, markSettlementProcessing, markSettlementSettled, type FinalizedAuctionResult, type SettlementRecord } from "./settlementRecords.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { getUnresolvedSettlementReservedAmount, isRetryableFailedSettlementRecord, MISSING_BID_AUTHORIZATION_FAILURE_REASON } from "./unresolvedSettlementReservedAmount.ts";

const advertiserAddress = "0x2222222222222222222222222222222222222222";
const otherAdvertiserAddress = "0x3333333333333333333333333333333333333333";
const bidAuthorization = {
  payload: {
    purpose: "PDOOH_BID_AUTHORIZATION",
    version: "1",
    advertiserAddress,
    businessName: "Acme",
    advertisementName: "Summer Sale",
    slotId: "slot-1",
    cycleId: "cycle-1",
    bidAmountMinorUnits: "1500000",
    chainId: 5_042_002,
    escrowAddress: "0x1111111111111111111111111111111111111111",
    treasuryAddress: "0x4444444444444444444444444444444444444444",
    usdcAddress: "0x3600000000000000000000000000000000000000",
    expiresAt: "2026-06-25T12:30:00.000Z",
  },
  signature:
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
} as const;

function createResult(
  slotId: string,
  amountMinorUnits: bigint,
  overrides: Partial<FinalizedAuctionResult> = {}
): FinalizedAuctionResult {
  return {
    chainId: 5_042_002,
    escrowAddress: "0x1111111111111111111111111111111111111111",
    treasuryAddress: "0x4444444444444444444444444444444444444444",
    usdcAddress: "0x3600000000000000000000000000000000000000",
    cycleId: "cycle-1",
    slotId,
    advertiserAddress,
    businessName: "Acme",
    advertisementName: `Advertisement ${slotId}`,
    amountMinorUnits,
    bidAuthorization: {
      payload: { ...bidAuthorization.payload, slotId },
      signature: bidAuthorization.signature,
    },
    ...overrides,
  };
}

function createPendingRecord(
  slotId: string,
  amountMinorUnits: bigint,
  overrides: Partial<FinalizedAuctionResult> = {}
) {
  return createPendingSettlementRecord(
    createResult(slotId, amountMinorUnits, overrides),
    "2026-06-25T12:00:00.000Z"
  );
}

function createFailedRecord(
  record: SettlementRecord,
  failureReason = "RPC unavailable."
) {
  return markSettlementFailed(
    markSettlementProcessing(record, "2026-06-25T12:01:00.000Z"),
    failureReason,
    "2026-06-25T12:02:00.000Z"
  );
}

test("unresolved reserved amount includes pending processing and retryable failed records", () => {
  const pending = createPendingRecord("slot-1", BigInt(1_500_000));
  const processing = markSettlementProcessing(
    createPendingRecord("slot-2", BigInt(2_000_000)),
    "2026-06-25T12:01:00.000Z"
  );
  const retryableFailed = createFailedRecord(
    createPendingRecord("slot-3", BigInt(3_000_000))
  );

  assert.equal(
    getUnresolvedSettlementReservedAmount(
      [pending, processing, retryableFailed],
      advertiserAddress
    ),
    6_500_000
  );
});

test("unresolved reserved amount excludes settled permanently failed and other advertiser records", () => {
  const settled = markSettlementSettled(
    markSettlementProcessing(
      createPendingRecord("slot-1", BigInt(1_500_000)),
      "2026-06-25T12:01:00.000Z"
    ),
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "2026-06-25T12:02:00.000Z"
  );
  const missingAuthorizationFailed = createFailedRecord(
    createPendingRecord("slot-2", BigInt(2_000_000), {
      bidAuthorization: undefined,
    }),
    MISSING_BID_AUTHORIZATION_FAILURE_REASON
  );
  const otherAdvertiserPending = createPendingRecord("slot-3", BigInt(3_000_000), {
    advertiserAddress: otherAdvertiserAddress,
  });

  assert.equal(
    getUnresolvedSettlementReservedAmount(
      [settled, missingAuthorizationFailed, otherAdvertiserPending],
      advertiserAddress
    ),
    0
  );
});

test("unsigned pending legacy records do not reserve withdraw funds forever", () => {
  const unsignedPending = createPendingRecord("slot-1", BigInt(1_500_000), {
    bidAuthorization: undefined,
  });

  assert.equal(
    getUnresolvedSettlementReservedAmount(
      [unsignedPending],
      advertiserAddress
    ),
    0
  );
});

test("failed settlement retryability requires bid authorization and non-permanent reason", () => {
  const retryableFailed = createFailedRecord(
    createPendingRecord("slot-1", BigInt(1_500_000))
  );
  const missingAuthorizationFailed = createFailedRecord(
    createPendingRecord("slot-2", BigInt(2_000_000), {
      bidAuthorization: undefined,
    }),
    MISSING_BID_AUTHORIZATION_FAILURE_REASON
  );

  assert.equal(isRetryableFailedSettlementRecord(retryableFailed), true);
  assert.equal(
    isRetryableFailedSettlementRecord(missingAuthorizationFailed),
    false
  );
});
