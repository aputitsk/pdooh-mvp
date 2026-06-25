import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createFinalizedAuctionResultsFromWinnersSnapshot } from "./finalizedWinnerResults.ts";

const advertiser = {
  name: "Summer Sale",
  businessName: "Acme",
};
const demoBot = {
  name: "Demo Advertisement",
  businessName: "Demo Bot",
};
const baseParams = {
  phase: "locked",
  cycleId: 7,
  chainId: 5_042_002,
  escrowAddress: "0x1111111111111111111111111111111111111111" as const,
  slotIds: ["slot-1"],
  winners: [advertiser],
  winnerBidAmounts: [1_500_000],
  winnerAdvertiserAddresses: [
    "0x2222222222222222222222222222222222222222",
  ] as const,
};

test('phase "open" returns an empty array', () => {
  assert.deepEqual(
    createFinalizedAuctionResultsFromWinnersSnapshot({
      ...baseParams,
      phase: "open",
    }),
    []
  );
});

test("valid non-bot winner creates a finalized result", () => {
  assert.deepEqual(
    createFinalizedAuctionResultsFromWinnersSnapshot(baseParams),
    [
      {
        chainId: baseParams.chainId,
        escrowAddress: baseParams.escrowAddress,
        cycleId: "7",
        slotId: "slot-1",
        advertiserAddress: baseParams.winnerAdvertiserAddresses[0],
        advertisementName: advertiser.name,
        amountMinorUnits: BigInt(1_500_000),
      },
    ]
  );
});

test("Demo Bot winner is skipped", () => {
  assert.deepEqual(
    createFinalizedAuctionResultsFromWinnersSnapshot({
      ...baseParams,
      winners: [demoBot],
    }),
    []
  );
});

test("null advertiserAddress is skipped", () => {
  assert.deepEqual(
    createFinalizedAuctionResultsFromWinnersSnapshot({
      ...baseParams,
      winnerAdvertiserAddresses: [null],
    }),
    []
  );
});

test("invalid amount is skipped", () => {
  for (const amount of [0, -1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(
      createFinalizedAuctionResultsFromWinnersSnapshot({
        ...baseParams,
        winnerBidAmounts: [amount],
      }),
      []
    );
  }
});

test("missing or empty slotId is skipped", () => {
  for (const slotIds of [[], [""]]) {
    assert.deepEqual(
      createFinalizedAuctionResultsFromWinnersSnapshot({
        ...baseParams,
        slotIds,
      }),
      []
    );
  }
});

test("multiple valid slots create multiple results", () => {
  const results = createFinalizedAuctionResultsFromWinnersSnapshot({
    ...baseParams,
    phase: "live",
    slotIds: ["slot-1", "slot-2"],
    winners: [
      advertiser,
      { name: "Winter Sale", businessName: "Acme" },
    ],
    winnerBidAmounts: [1_500_000, 2_000_000],
    winnerAdvertiserAddresses: [
      "0x2222222222222222222222222222222222222222",
      "0x3333333333333333333333333333333333333333",
    ],
  });

  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((result) => result.slotId),
    ["slot-1", "slot-2"]
  );
});

test("numeric cycleId is converted to string", () => {
  const [result] =
    createFinalizedAuctionResultsFromWinnersSnapshot(baseParams);

  assert.equal(result.cycleId, "7");
});
