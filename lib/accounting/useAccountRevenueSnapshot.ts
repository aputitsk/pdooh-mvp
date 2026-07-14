"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import type { AccountRevenueSnapshot } from "./accountRevenueTypes";
import {
  getSettlementRecordSnapshot,
  subscribeToSettlementRecordChanges,
} from "./settlementRecordSync";

type AccountRevenueResponse = {
  ok?: boolean;
  snapshot?: AccountRevenueSnapshot | null;
};

function isHexString(value: unknown): value is `0x${string}` {
  return typeof value === "string" && value.startsWith("0x");
}

function isAccountRevenueSnapshot(
  value: unknown
): value is AccountRevenueSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const snapshot = value as Partial<AccountRevenueSnapshot>;

  return (
    snapshot.schemaVersion === 1 &&
    isHexString(snapshot.walletAddress) &&
    typeof snapshot.totalAmountMinorUnits === "string" &&
    /^\d+$/.test(snapshot.totalAmountMinorUnits) &&
    (snapshot.lastPayment === null ||
      typeof snapshot.lastPayment === "object") &&
    (snapshot.lastMemo === null || typeof snapshot.lastMemo === "object")
  );
}

export function useAccountRevenueSnapshot(accountAddress: string | null) {
  const settlementRecordVersion = useSyncExternalStore(
    subscribeToSettlementRecordChanges,
    getSettlementRecordSnapshot,
    getSettlementRecordSnapshot
  );
  const [snapshot, setSnapshot] = useState<AccountRevenueSnapshot | null>(null);

  const loadSnapshot = useCallback(async () => {
    if (!accountAddress) {
      return null;
    }

    try {
      const response = await fetch(
        `/api/account/revenue?walletAddress=${encodeURIComponent(
          accountAddress
        )}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as AccountRevenueResponse;

      return response.ok &&
        payload.ok &&
        isAccountRevenueSnapshot(payload.snapshot)
        ? payload.snapshot
        : null;
    } catch {
      return undefined;
    }
  }, [accountAddress]);

  const refresh = useCallback(async () => {
    const nextSnapshot = await loadSnapshot();

    if (nextSnapshot !== undefined) {
      setSnapshot(nextSnapshot);
    }
  }, [loadSnapshot]);

  useEffect(() => {
    let isActive = true;

    async function syncSnapshot() {
      const nextSnapshot = await loadSnapshot();

      if (isActive && nextSnapshot !== undefined) {
        setSnapshot(nextSnapshot);
      }
    }

    void syncSnapshot();

    return () => {
      isActive = false;
    };
  }, [loadSnapshot, settlementRecordVersion]);

  useEffect(() => {
    if (!accountAddress) {
      return;
    }

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    const refreshSnapshot = () => {
      void refresh();
    };

    window.addEventListener("focus", refreshSnapshot);
    window.addEventListener("pageshow", refreshSnapshot);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener("focus", refreshSnapshot);
      window.removeEventListener("pageshow", refreshSnapshot);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [accountAddress, refresh]);

  return {
    snapshot: accountAddress ? snapshot : null,
    refresh,
  };
}
