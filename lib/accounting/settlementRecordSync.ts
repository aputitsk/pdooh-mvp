import {
  createBrowserSettlementRepository,
  isSettlementRecordStorageKey,
  type SettlementRepository,
} from "./settlementRepository";
import type { SettlementRecord } from "./settlementRecords";

const listeners = new Set<() => void>();
let version = 0;

export function subscribeToSettlementRecordChanges(listener: () => void) {
  listeners.add(listener);

  if (typeof window === "undefined") {
    return () => {
      listeners.delete(listener);
    };
  }

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === null || isSettlementRecordStorageKey(event.key)) {
      notifySettlementRecordsChanged();
    }
  };

  window.addEventListener("storage", handleStorageChange);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorageChange);
  };
}

export function getSettlementRecordSnapshot() {
  return version;
}

export function notifySettlementRecordsChanged() {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function listSettlementRecords(
  repository: SettlementRepository
): SettlementRecord[] {
  return [
    ...repository.listByStatus("pending_playback"),
    ...repository.listByStatus("ready_to_settle"),
    ...repository.listByStatus("processing"),
    ...repository.listByStatus("settled"),
    ...repository.listByStatus("failed_retryable"),
    ...repository.listByStatus("failed_terminal"),
  ];
}

export function listBrowserSettlementRecords(): SettlementRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  return listSettlementRecords(createBrowserSettlementRepository());
}
