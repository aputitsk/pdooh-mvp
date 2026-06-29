import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createFinalizedAuctionResult } from "./finalizedAuctionResults.ts";

const bidAuthorization = {
  payload: {
    purpose: "PDOOH_BID_AUTHORIZATION",
    version: "1",
    advertiserAddress:
      "0x2222222222222222222222222222222222222222" as const,
    businessName: "Acme",
    advertisementName: "Summer Sale",
    slotId: "slot-1",
    cycleId: "cycle-1",
    bidAmountMinorUnits: "1500000",
    chainId: 5_042_002,
    escrowAddress: "0x1111111111111111111111111111111111111111" as const,
    treasuryAddress: "0x3333333333333333333333333333333333333333" as const,
    usdcAddress: "0x3600000000000000000000000000000000000000" as const,
    expiresAt: "2026-06-25T12:30:00.000Z",
  },
  signature:
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
} as const;

const validParams = {
  chainId: 5_042_002,
  escrowAddress: "0x1111111111111111111111111111111111111111" as const,
  treasuryAddress: "0x3333333333333333333333333333333333333333" as const,
  usdcAddress: "0x3600000000000000000000000000000000000000" as const,
  cycleId: "cycle-1",
  slotId: "slot-1",
  advertiserAddress:
    "0x2222222222222222222222222222222222222222" as const,
  businessName: "Acme",
  advertisementName: "Summer Sale",
  amountMinorUnits: 1_500_000,
  bidAuthorization,
};

test("valid input creates a FinalizedAuctionResult", () => {
  assert.deepEqual(createFinalizedAuctionResult(validParams), {
    ...validParams,
    amountMinorUnits: BigInt(validParams.amountMinorUnits),
  });
});

test("null advertiserAddress returns null", () => {
  assert.equal(
    createFinalizedAuctionResult({
      ...validParams,
      advertiserAddress: null,
    }),
    null
  );
});

test("missing bidAuthorization returns null", () => {
  assert.equal(
    createFinalizedAuctionResult({
      ...validParams,
      bidAuthorization: null,
    }),
    null
  );
});

test("non-positive amountMinorUnits returns null", () => {
  for (const amountMinorUnits of [0, -1]) {
    assert.equal(
      createFinalizedAuctionResult({ ...validParams, amountMinorUnits }),
      null
    );
  }
});

test("unsafe amountMinorUnits returns null", () => {
  assert.equal(
    createFinalizedAuctionResult({
      ...validParams,
      amountMinorUnits: Number.MAX_SAFE_INTEGER + 1,
    }),
    null
  );
});

test("invalid escrow or advertiser address returns null", () => {
  assert.equal(
    createFinalizedAuctionResult({
      ...validParams,
      escrowAddress: "0xinvalid",
    }),
    null
  );
  assert.equal(
    createFinalizedAuctionResult({
      ...validParams,
      advertiserAddress: "0xinvalid",
    }),
    null
  );
});

test("amountMinorUnits is converted to bigint", () => {
  const result = createFinalizedAuctionResult(validParams);

  assert.ok(result);
  assert.equal(typeof result.amountMinorUnits, "bigint");
  assert.equal(result.amountMinorUnits, BigInt(validParams.amountMinorUnits));
});

test("input is not mutated", () => {
  const input = { ...validParams };
  const inputBefore = { ...input };

  createFinalizedAuctionResult(input);

  assert.deepEqual(input, inputBefore);
});
