import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createSettlementRepository } from "./settlementRepository.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createPendingSettlementRecord } from "./settlementRecords.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function createRecord(slotId: string, amountMinorUnits: bigint) {
  return createPendingSettlementRecord(
    {
      chainId: 5_042_002,
      escrowAddress: "0x1111111111111111111111111111111111111111",
      treasuryAddress: "0x3333333333333333333333333333333333333333",
      usdcAddress: "0x3600000000000000000000000000000000000000",
      marketId: "new-york",
      siteId: "times-square",
      cycleId: "cycle-7",
      slotId,
      advertiserAddress: "0x2222222222222222222222222222222222222222",
      businessName: "Acme",
      advertisementName: `Advertisement ${slotId}`,
      amountMinorUnits,
    },
    "2026-06-25T12:00:00.000Z"
  );
}

test("saveIfAbsent stores a new SettlementRecord", () => {
  const repository = createSettlementRepository(new MemoryStorage());
  const record = createRecord("slot-1", BigInt(1_500_000));

  assert.equal(repository.saveIfAbsent(record), true);
  assert.deepEqual(repository.getById(record.settlementId), record);
});

test("saveIfAbsent does not duplicate the same settlementId", () => {
  const repository = createSettlementRepository(new MemoryStorage());
  const record = createRecord("slot-1", BigInt(1_500_000));

  assert.equal(repository.saveIfAbsent(record), true);
  assert.equal(repository.saveIfAbsent(record), false);
  assert.equal(repository.listByStatus("pending_playback").length, 1);
});

test("different settlementIds in one cycle are stored separately", () => {
  const repository = createSettlementRepository(new MemoryStorage());
  const first = createRecord("slot-1", BigInt(1_500_000));
  const second = createRecord("slot-2", BigInt(2_000_000));

  assert.equal(first.result.cycleId, second.result.cycleId);
  assert.notEqual(first.settlementId, second.settlementId);
  assert.equal(repository.saveIfAbsent(first), true);
  assert.equal(repository.saveIfAbsent(second), true);
  assert.equal(repository.listByStatus("pending_playback").length, 2);
});

test("getById returns the stored record", () => {
  const repository = createSettlementRepository(new MemoryStorage());
  const record = createRecord("slot-1", BigInt(1_500_000));

  repository.saveIfAbsent(record);

  assert.deepEqual(repository.getById(record.settlementId), record);
});

test("update replaces an existing SettlementRecord", () => {
  const repository = createSettlementRepository(new MemoryStorage());
  const record = createRecord("slot-1", BigInt(1_500_000));
  const processing = { ...record, status: "processing" as const };

  repository.saveIfAbsent(record);

  assert.equal(repository.update(processing), true);
  assert.deepEqual(repository.getById(record.settlementId), processing);
});

test('listByStatus("pending_playback") returns only pending playback records', () => {
  const repository = createSettlementRepository(new MemoryStorage());
  const pending = createRecord("slot-1", BigInt(1_500_000));
  const settled = {
    ...createRecord("slot-2", BigInt(2_000_000)),
    status: "settled" as const,
  };
  const failed = {
    ...createRecord("slot-3", BigInt(3_000_000)),
    status: "failed_retryable" as const,
    failureReason: "Settlement failed.",
  };

  repository.saveIfAbsent(pending);
  repository.saveIfAbsent(settled);
  repository.saveIfAbsent(failed);

  assert.deepEqual(repository.listByStatus("pending_playback"), [pending]);
});
