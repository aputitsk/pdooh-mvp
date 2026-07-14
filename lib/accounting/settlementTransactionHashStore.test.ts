import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const settlementId =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const firstTransactionHash =
  "0x2222222222222222222222222222222222222222222222222222222222222222";
const secondTransactionHash =
  "0x3333333333333333333333333333333333333333333333333333333333333333";

async function importStoreWithTempDirectory() {
  const storeDirectory = await mkdtemp(
    join(tmpdir(), "pdooh-settlement-hash-store-")
  );
  process.env.PDOOH_SETTLEMENT_HASH_STORE_DIR = storeDirectory;

  const storeModule = await import(
    `./settlementTransactionHashStore.ts?test=${Date.now()}-${Math.random()}`
  );

  return { storeDirectory, storeModule };
}

test("settlement transaction hash store persists hashes by settlementId", async () => {
  const { storeDirectory, storeModule } =
    await importStoreWithTempDirectory();

  try {
    assert.equal(
      await storeModule.getStoredSettlementTransactionHash(settlementId),
      null
    );

    await storeModule.saveSettlementTransactionHash(
      settlementId,
      firstTransactionHash
    );

    assert.equal(
      await storeModule.getStoredSettlementTransactionHash(settlementId),
      firstTransactionHash
    );

    await storeModule.saveSettlementTransactionHash(
      settlementId,
      secondTransactionHash
    );

    assert.equal(
      await storeModule.getStoredSettlementTransactionHash(settlementId),
      secondTransactionHash
    );
  } finally {
    delete process.env.PDOOH_SETTLEMENT_HASH_STORE_DIR;
    await rm(storeDirectory, { force: true, recursive: true });
  }
});
