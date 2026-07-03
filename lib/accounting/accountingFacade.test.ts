import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createPendingSettlementRecords } from "./accountingFacade.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createSettlementId, SETTLEMENT_IDENTITY_VERSION_V2 } from "./settlementRecords.ts";

const nowIso = "2026-06-25T12:00:00.000Z";
const bidAuthorization = {
  payload: {
    purpose: "PDOOH_BID_AUTHORIZATION",
    version: "2",
    marketId: "new-york",
    siteId: "times-square",
    advertiserAddress:
      "0x2222222222222222222222222222222222222222" as const,
    businessName: "Acme",
    advertisementName: "Summer Sale",
    slotId: "slot-1",
    cycleId: "7",
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
const snapshot = {
  phase: "locked",
  cycleId: 7,
  chainId: 5_042_002,
  escrowAddress: "0x1111111111111111111111111111111111111111" as const,
  treasuryAddress: "0x3333333333333333333333333333333333333333" as const,
  usdcAddress: "0x3600000000000000000000000000000000000000" as const,
  marketId: "new-york" as const,
  siteId: "times-square" as const,
  slotIds: ["slot-1"],
  winners: [{ name: "Summer Sale", businessName: "Acme" }],
  winnerBidAmounts: [1_500_000],
  winnerAdvertiserAddresses: [
    "0x2222222222222222222222222222222222222222",
  ] as const,
  winnerBidAuthorizations: [bidAuthorization],
};

test("facade creates pending settlement records from an auction snapshot", () => {
  const records = createPendingSettlementRecords({ snapshot, nowIso });

  assert.equal(records.length, 1);
  assert.equal(records[0].status, "pending");
  assert.equal(records[0].identityVersion, SETTLEMENT_IDENTITY_VERSION_V2);
  assert.equal(records[0].createdAt, nowIso);
  assert.equal(records[0].updatedAt, nowIso);
  assert.equal(records[0].settlementId, createSettlementId(records[0].result));
  assert.deepEqual(records[0].result, {
    chainId: snapshot.chainId,
    escrowAddress: snapshot.escrowAddress,
    treasuryAddress: snapshot.treasuryAddress,
    usdcAddress: snapshot.usdcAddress,
    marketId: snapshot.marketId,
    siteId: snapshot.siteId,
    cycleId: "7",
    slotId: "slot-1",
    advertiserAddress: snapshot.winnerAdvertiserAddresses[0],
    businessName: "Acme",
    advertisementName: "Summer Sale",
    amountMinorUnits: BigInt(1_500_000),
    bidAuthorization,
  });
});

test("facade skips invalid and Demo Bot winners", () => {
  const records = createPendingSettlementRecords({
    nowIso,
    snapshot: {
      ...snapshot,
      slotIds: ["slot-1", "slot-2", "slot-3"],
      winners: [
        snapshot.winners[0],
        { name: "Demo Advertisement", businessName: "Demo Bot" },
        { name: "Missing Address", businessName: "Acme" },
      ],
      winnerBidAmounts: [1_500_000, 2_000_000, 3_000_000],
      winnerAdvertiserAddresses: [
        snapshot.winnerAdvertiserAddresses[0],
        null,
        null,
      ],
      winnerBidAuthorizations: [bidAuthorization, null, null],
    },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].result.slotId, "slot-1");
});

test("facade returns no records before winner finalization", () => {
  assert.deepEqual(
    createPendingSettlementRecords({
      nowIso,
      snapshot: { ...snapshot, phase: "open" },
    }),
    []
  );
});

test("facade does not mutate the snapshot", () => {
  const input = {
    snapshot: {
      ...snapshot,
      slotIds: [...snapshot.slotIds],
      winners: snapshot.winners.map((winner) => ({ ...winner })),
      winnerBidAmounts: [...snapshot.winnerBidAmounts],
      winnerAdvertiserAddresses: [...snapshot.winnerAdvertiserAddresses],
      winnerBidAuthorizations: [...snapshot.winnerBidAuthorizations],
    },
    nowIso,
  };
  const before = structuredClone(input);

  createPendingSettlementRecords(input);

  assert.deepEqual(input, before);
});
