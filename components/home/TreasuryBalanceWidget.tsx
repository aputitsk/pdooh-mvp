"use client";

import { useSyncExternalStore } from "react";
import {
  getSettlementRecordSnapshot,
  listBrowserSettlementRecords,
  subscribeToSettlementRecordChanges,
} from "@/lib/accounting/settlementRecordSync";
import type { SettlementRecord } from "@/lib/accounting/settlementRecords";
import {
  formatUSDCFromMinorUnits,
  USDC_DECIMALS,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

const LAST_SETTLEMENT_DISPLAY_DECIMALS = 3;
const subscribeToHydration = () => () => {};
const getHydratedSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

function isSuccessfulSettlement(record: SettlementRecord) {
  return record.status === "settled" || record.status === "already_settled";
}

function addSafeMinorUnits(
  current: UsdcMinorUnits,
  amount: bigint
): UsdcMinorUnits {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.MAX_SAFE_INTEGER;
  }

  const next = current + Number(amount);
  return Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
}

function formatLastSettlementAmount(amount: bigint) {
  const displayScale = BigInt(10 ** LAST_SETTLEMENT_DISPLAY_DECIMALS);
  const minorUnitScale = BigInt(
    10 ** (USDC_DECIMALS - LAST_SETTLEMENT_DISPLAY_DECIMALS)
  );
  const roundedDisplayUnits =
    (amount + minorUnitScale / BigInt(2)) / minorUnitScale;
  const wholePart = roundedDisplayUnits / displayScale;
  const fractionalPart = roundedDisplayUnits % displayScale;

  return `${wholePart}.${fractionalPart
    .toString()
    .padStart(LAST_SETTLEMENT_DISPLAY_DECIMALS, "0")}`;
}

function getPlatformRevenue(records: readonly SettlementRecord[]) {
  return records.filter(isSuccessfulSettlement).reduce<UsdcMinorUnits>(
    (total, record) => addSafeMinorUnits(total, record.result.amountMinorUnits),
    0
  );
}

function getLastSuccessfulSettlement(records: readonly SettlementRecord[]) {
  return records.filter(isSuccessfulSettlement).sort((first, second) => {
    return Date.parse(second.updatedAt) - Date.parse(first.updatedAt);
  })[0];
}

export default function TreasuryBalanceWidget() {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydrationSnapshot
  );

  useSyncExternalStore(
    subscribeToSettlementRecordChanges,
    getSettlementRecordSnapshot,
    getSettlementRecordSnapshot
  );
  const settlementRecords = isHydrated ? listBrowserSettlementRecords() : [];
  const platformRevenue = getPlatformRevenue(settlementRecords);
  const lastSuccessfulSettlement =
    getLastSuccessfulSettlement(settlementRecords);

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center shadow-sm shadow-black/10">
      <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">
        Platform Revenue
      </p>
      <p className="mt-0.5 text-sm font-bold text-white">
        {formatUSDCFromMinorUnits(platformRevenue)} Test USDC
      </p>
      <p
        className={`mt-0.5 text-[10px] leading-4 ${
          lastSuccessfulSettlement ? "text-emerald-400" : "text-white/35"
        }`}
      >
        {lastSuccessfulSettlement
          ? `+${formatLastSettlementAmount(
              lastSuccessfulSettlement.result.amountMinorUnits
            )} USDC  Last settlement`
          : "No settlements yet"}
      </p>
    </div>
  );
}
