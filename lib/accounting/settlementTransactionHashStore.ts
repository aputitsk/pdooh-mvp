import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

type HexHash = `0x${string}`;

type SettlementTransactionHashStoreFile = {
  version: 1;
  transactions: Record<string, HexHash>;
};

const STORE_DIRECTORY =
  process.env.PDOOH_SETTLEMENT_HASH_STORE_DIR ?? join(process.cwd(), "cache");
const STORE_FILE = join(
  STORE_DIRECTORY,
  "operator-settlement-transaction-hashes.json"
);
let writeQueue = Promise.resolve();

function normalizeHash(value: HexHash) {
  return value.toLowerCase() as HexHash;
}

function isBytes32Hex(value: string): value is HexHash {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

async function readStore(): Promise<SettlementTransactionHashStoreFile> {
  try {
    const rawStore = await readFile(STORE_FILE, "utf8");
    const parsedStore = JSON.parse(rawStore) as Partial<{
      version: unknown;
      transactions: unknown;
    }>;

    if (
      parsedStore.version !== 1 ||
      typeof parsedStore.transactions !== "object" ||
      parsedStore.transactions === null
    ) {
      return { version: 1, transactions: {} };
    }

    return {
      version: 1,
      transactions: Object.fromEntries(
        Object.entries(parsedStore.transactions).filter(
          (entry): entry is [string, HexHash] => {
            const [settlementId, transactionHash] = entry;

            return (
              isBytes32Hex(settlementId) &&
              typeof transactionHash === "string" &&
              isBytes32Hex(transactionHash)
            );
          }
        )
      ),
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { version: 1, transactions: {} };
    }

    throw error;
  }
}

async function writeStore(store: SettlementTransactionHashStoreFile) {
  await mkdir(STORE_DIRECTORY, { recursive: true });
  const tempFile = `${STORE_FILE}.${Date.now()}.${Math.random()
    .toString(16)
    .slice(2)}.tmp`;

  await writeFile(tempFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(tempFile, STORE_FILE);
}

export async function getStoredSettlementTransactionHash(
  settlementId: HexHash
) {
  const normalizedSettlementId = normalizeHash(settlementId);
  const store = await readStore();

  return store.transactions[normalizedSettlementId] ?? null;
}

export async function saveSettlementTransactionHash(
  settlementId: HexHash,
  transactionHash: HexHash
) {
  const normalizedSettlementId = normalizeHash(settlementId);
  const normalizedTransactionHash = normalizeHash(transactionHash);

  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const store = await readStore();

    store.transactions[normalizedSettlementId] = normalizedTransactionHash;
    await writeStore(store);
  });

  await writeQueue;
}
