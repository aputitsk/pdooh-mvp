import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createPendingSettlementRecords } from "./accountingFacade.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createSettlementId } from "./settlementRecords.ts";

const nowIso = "2026-06-25T12:00:00.000Z";
const snapshot = {
  phase: "locked",
  cycleId: 7,
  chainId: 5_042_002,
  escrowAddress: "0x1111111111111111111111111111111111111111" as const,
  slotIds: ["slot-1"],
  winners: [{ name: "Summer Sale", businessName: "Acme" }],
  winnerBidAmounts: [1_500_000],
  winnerAdvertiserAddresses: [
    "0x2222222222222222222222222222222222222222",
  ] as const,
};

test("facade creates pending settlement records from an auction snapshot", () => {
  const records = createPendingSettlementRecords({ snapshot, nowIso });

  assert.equal(records.length, 1);
  assert.equal(records[0].status, "pending");
  assert.equal(records[0].createdAt, nowIso);
  assert.equal(records[0].updatedAt, nowIso);
  assert.equal(records[0].settlementId, createSettlementId(records[0].result));
  assert.deepEqual(records[0].result, {
    chainId: snapshot.chainId,
    escrowAddress: snapshot.escrowAddress,
    cycleId: "7",
    slotId: "slot-1",
    advertiserAddress: snapshot.winnerAdvertiserAddresses[0],
    advertisementName: "Summer Sale",
    amountMinorUnits: BigInt(1_500_000),
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
    },
    nowIso,
  };
  const before = structuredClone(input);

  createPendingSettlementRecords(input);

  assert.deepEqual(input, before);
});
