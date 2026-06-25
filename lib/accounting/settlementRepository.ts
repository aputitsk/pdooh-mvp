import type {
  SettlementRecord,
  SettlementStatus,
} from "./settlementRecords";

const SETTLEMENT_RECORD_KEY_PREFIX = "pdooh-accounting-settlement:";

type SettlementRecordStorage = {
  readonly length: number;
  getItem(key: string): string | null;
  key(index: number): string | null;
  setItem(key: string, value: string): void;
};

type StoredSettlementRecord = Omit<SettlementRecord, "result"> & {
  result: Omit<SettlementRecord["result"], "amountMinorUnits"> & {
    amountMinorUnits: string;
  };
};

export type SettlementRepository = {
  saveIfAbsent(record: SettlementRecord): boolean;
  update(record: SettlementRecord): boolean;
  getById(settlementId: `0x${string}`): SettlementRecord | null;
  listByStatus(status: SettlementStatus): SettlementRecord[];
};

function getSettlementRecordKey(settlementId: `0x${string}`) {
  return `${SETTLEMENT_RECORD_KEY_PREFIX}${settlementId.toLowerCase()}`;
}

function serializeSettlementRecord(record: SettlementRecord) {
  const storedRecord: StoredSettlementRecord = {
    ...record,
    result: {
      ...record.result,
      amountMinorUnits: record.result.amountMinorUnits.toString(),
    },
  };

  return JSON.stringify(storedRecord);
}

function deserializeSettlementRecord(value: string): SettlementRecord | null {
  try {
    const storedRecord = JSON.parse(value) as StoredSettlementRecord;
    const amountMinorUnits = BigInt(storedRecord.result.amountMinorUnits);

    return {
      ...storedRecord,
      result: {
        ...storedRecord.result,
        amountMinorUnits,
      },
    };
  } catch {
    return null;
  }
}

export function createSettlementRepository(
  storage: SettlementRecordStorage
): SettlementRepository {
  return {
    saveIfAbsent(record) {
      const key = getSettlementRecordKey(record.settlementId);

      if (storage.getItem(key) !== null) {
        return false;
      }

      storage.setItem(key, serializeSettlementRecord(record));
      return true;
    },

    update(record) {
      const key = getSettlementRecordKey(record.settlementId);

      if (storage.getItem(key) === null) {
        return false;
      }

      storage.setItem(key, serializeSettlementRecord(record));
      return true;
    },

    getById(settlementId) {
      const value = storage.getItem(getSettlementRecordKey(settlementId));

      return value === null ? null : deserializeSettlementRecord(value);
    },

    listByStatus(status) {
      const records: SettlementRecord[] = [];

      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);

        if (!key?.startsWith(SETTLEMENT_RECORD_KEY_PREFIX)) {
          continue;
        }

        const value = storage.getItem(key);
        const record =
          value === null ? null : deserializeSettlementRecord(value);

        if (record?.status === status) {
          records.push(record);
        }
      }

      return records;
    },
  };
}

export function createBrowserSettlementRepository() {
  if (typeof window === "undefined") {
    throw new Error("SettlementRepository requires browser storage.");
  }

  return createSettlementRepository(window.localStorage);
}
