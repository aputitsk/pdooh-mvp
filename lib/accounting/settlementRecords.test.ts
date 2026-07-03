import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createPendingSettlementRecord, createSettlementId, isV2SettlementRecord, markSettlementFailed, markSettlementProcessing, markSettlementSettled, SETTLEMENT_IDENTITY_VERSION_V2, type FinalizedAuctionResult, type SettlementRecord } from "./settlementRecords.ts";

const baseResult: FinalizedAuctionResult = {
  chainId: 5_042_002,
  escrowAddress: "0x1111111111111111111111111111111111111111",
  treasuryAddress: "0x3333333333333333333333333333333333333333",
  usdcAddress: "0x3600000000000000000000000000000000000000",
  marketId: "new-york",
  siteId: "times-square",
  cycleId: "cycle-1",
  slotId: "slot-1",
  advertiserAddress: "0x2222222222222222222222222222222222222222",
  businessName: "Acme",
  advertisementName: "Summer Sale",
  amountMinorUnits: BigInt(1_500_000),
};

test("createSettlementId returns the same ID for the same input", () => {
  assert.equal(createSettlementId(baseResult), createSettlementId(baseResult));
});

test("createSettlementId changes when an identity field changes", () => {
  const baseSettlementId = createSettlementId(baseResult);
  const variants: FinalizedAuctionResult[] = [
    { ...baseResult, chainId: baseResult.chainId + 1 },
    {
      ...baseResult,
      escrowAddress: "0x3333333333333333333333333333333333333333",
    },
    {
      ...baseResult,
      marketId: "los-angeles",
      siteId: "hollywood-boulevard",
    },
    { ...baseResult, cycleId: "cycle-2" },
    { ...baseResult, slotId: "slot-2" },
    {
      ...baseResult,
      advertiserAddress: "0x4444444444444444444444444444444444444444",
    },
    {
      ...baseResult,
      amountMinorUnits: baseResult.amountMinorUnits + BigInt(1),
    },
  ];

  for (const variant of variants) {
    assert.notEqual(createSettlementId(variant), baseSettlementId);
  }
});

test("createSettlementId separates sites with identical cycle and slot", () => {
  const newYorkId = createSettlementId({
    ...baseResult,
    marketId: "new-york",
    siteId: "times-square",
    cycleId: "5",
    slotId: "slot-1",
  });
  const losAngelesId = createSettlementId({
    ...baseResult,
    marketId: "los-angeles",
    siteId: "hollywood-boulevard",
    cycleId: "5",
    slotId: "slot-1",
  });

  assert.notEqual(newYorkId, losAngelesId);
});

test("createPendingSettlementRecord rejects non-positive minor units", () => {
  for (const amountMinorUnits of [BigInt(0), BigInt(-1)]) {
    assert.throws(
      () =>
        createPendingSettlementRecord(
          { ...baseResult, amountMinorUnits },
          "2026-06-25T12:00:00.000Z"
        ),
      /amountMinorUnits must be greater than zero/
    );
  }
});

test("createPendingSettlementRecord rejects missing site identity", () => {
  assert.throws(
    () =>
      createPendingSettlementRecord(
        {
          ...baseResult,
          marketId: "" as FinalizedAuctionResult["marketId"],
        },
        "2026-06-25T12:00:00.000Z"
      ),
    /marketId must be a non-empty string/
  );
});

test("createPendingSettlementRecord rejects an empty nowIso", () => {
  for (const nowIso of ["", "   "]) {
    assert.throws(
      () => createPendingSettlementRecord(baseResult, nowIso),
      /nowIso must be a non-empty string/
    );
  }
});

test("createPendingSettlementRecord creates a deterministic pending record without mutating input", () => {
  const nowIso = "2026-06-25T12:00:00.000Z";
  const input: FinalizedAuctionResult = { ...baseResult };
  const inputBefore = { ...input };

  const record = createPendingSettlementRecord(input, nowIso);

  assert.equal(record.status, "pending");
  assert.equal(record.identityVersion, SETTLEMENT_IDENTITY_VERSION_V2);
  assert.equal(record.createdAt, nowIso);
  assert.equal(record.updatedAt, nowIso);
  assert.equal(record.settlementId, createSettlementId(input));
  assert.deepEqual(record.result, input);
  assert.notStrictEqual(record.result, input);
  assert.deepEqual(input, inputBefore);
});

test("isV2SettlementRecord keeps legacy records out of v2 processing", () => {
  const record = createPendingSettlementRecord(
    baseResult,
    "2026-06-25T12:00:00.000Z"
  );
  const legacyRecord = {
    ...record,
    identityVersion: undefined,
    result: {
      ...record.result,
      marketId: undefined,
      siteId: undefined,
    },
  } as unknown as SettlementRecord;

  assert.equal(isV2SettlementRecord(record), true);
  assert.equal(isV2SettlementRecord(legacyRecord), false);
});

test("settlement lifecycle follows pending to processing to settled", () => {
  const pending = createPendingSettlementRecord(
    baseResult,
    "2026-06-25T12:00:00.000Z"
  );
  const processing = markSettlementProcessing(
    pending,
    "2026-06-25T12:01:00.000Z"
  );
  const settled = markSettlementSettled(
    processing,
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "2026-06-25T12:02:00.000Z"
  );

  assert.equal(processing.status, "processing");
  assert.equal(settled.status, "settled");
  assert.equal(
    settled.txHash,
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  );
});

test("only failed settlements can retry after the initial pending attempt", () => {
  const pending = createPendingSettlementRecord(
    baseResult,
    "2026-06-25T12:00:00.000Z"
  );
  const processing = markSettlementProcessing(
    pending,
    "2026-06-25T12:01:00.000Z"
  );
  const failed = markSettlementFailed(
    processing,
    "RPC unavailable.",
    "2026-06-25T12:02:00.000Z"
  );
  const retry = markSettlementProcessing(
    failed,
    "2026-06-25T12:03:00.000Z"
  );

  assert.equal(failed.status, "failed");
  assert.equal(retry.status, "processing");
  assert.throws(() =>
    markSettlementProcessing(
      { ...processing, status: "settled" },
      "2026-06-25T12:04:00.000Z"
    )
  );
});
