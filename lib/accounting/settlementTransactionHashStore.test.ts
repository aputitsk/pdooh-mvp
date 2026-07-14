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
const mixedCaseTransactionHash =
  "0xAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

async function importStoreWithTempDirectory() {
  const storeDirectory = await mkdtemp(
    join(tmpdir(), "pdooh-settlement-hash-store-")
  );
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.KV_REST_API_URL;
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

test("settlement transaction hash store uses Vercel KV Redis when configured", async () => {
  const originalFetch = globalThis.fetch;
  const storedValues = new Map<string, string>();
  const commands: unknown[][] = [];

  process.env.KV_REST_API_URL = "https://example-kv.upstash.io/";
  process.env.KV_REST_API_TOKEN = "test-token";
  delete process.env.PDOOH_SETTLEMENT_HASH_STORE_DIR;

  globalThis.fetch = (async (input, init) => {
    assert.equal(input, "https://example-kv.upstash.io");
    assert.equal(init?.method, "POST");
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer test-token"
    );

    const command = JSON.parse(String(init?.body)) as unknown[];
    commands.push(command);

    if (command[0] === "GET" && typeof command[1] === "string") {
      return Response.json({ result: storedValues.get(command[1]) ?? null });
    }

    if (
      command[0] === "SET" &&
      typeof command[1] === "string" &&
      typeof command[2] === "string"
    ) {
      storedValues.set(command[1], command[2]);

      return Response.json({ result: "OK" });
    }

    return Response.json({ error: "Unsupported command" }, { status: 400 });
  }) as typeof fetch;

  const storeModule = await import(
    `./settlementTransactionHashStore.ts?test=${Date.now()}-${Math.random()}`
  );

  try {
    assert.equal(
      await storeModule.getStoredSettlementTransactionHash(settlementId),
      null
    );

    await storeModule.saveSettlementTransactionHash(
      settlementId,
      mixedCaseTransactionHash
    );

    assert.equal(
      await storeModule.getStoredSettlementTransactionHash(settlementId),
      mixedCaseTransactionHash.toLowerCase()
    );
    assert.deepEqual(commands, [
      ["GET", `pdooh:settlement-transaction-hash:${settlementId}`],
      [
        "SET",
        `pdooh:settlement-transaction-hash:${settlementId}`,
        mixedCaseTransactionHash.toLowerCase(),
      ],
      ["GET", `pdooh:settlement-transaction-hash:${settlementId}`],
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.KV_REST_API_URL;
  }
});
