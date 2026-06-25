import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createFinalizedAuctionResult } from "./finalizedAuctionResults.ts";

const validParams = {
  chainId: 5_042_002,
  escrowAddress: "0x1111111111111111111111111111111111111111" as const,
  cycleId: "cycle-1",
  slotId: "slot-1",
  advertiserAddress:
    "0x2222222222222222222222222222222222222222" as const,
  advertisementName: "Summer Sale",
  amountMinorUnits: 1_500_000,
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
