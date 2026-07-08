import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { getSettlementEligibleLiveSlotIds } from "./liveSlotCompletion.ts";

const slotIds = ["slot-1", "slot-2", "slot-3"] as const;

test("locked phase has no settlement-eligible slots", () => {
  assert.deepEqual(
    getSettlementEligibleLiveSlotIds(
      {
        phase: "locked",
        secondsRemaining: 1,
        currentSlotIndex: 0,
        cycleId: 7,
        elapsedInCycle: 61,
      },
      slotIds
    ),
    []
  );
});

test("live future slots are not settlement-eligible yet", () => {
  assert.deepEqual(
    getSettlementEligibleLiveSlotIds(
      {
        phase: "live",
        secondsRemaining: 10,
        currentSlotIndex: 0,
        cycleId: 7,
        elapsedInCycle: 62,
      },
      slotIds
    ),
    []
  );
});

test("live slots become settlement-eligible after the trigger point", () => {
  assert.deepEqual(
    getSettlementEligibleLiveSlotIds(
      {
        phase: "live",
        secondsRemaining: 6,
        currentSlotIndex: 0,
        cycleId: 7,
        elapsedInCycle: 66,
      },
      slotIds
    ),
    ["slot-1"]
  );
});
