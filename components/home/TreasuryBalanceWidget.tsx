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
const iconBadgeClassName =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#4F8CFF]/35 bg-[radial-gradient(circle_at_35%_25%,#183B6A_0%,#10284D_74%)] text-[#E7F0FF] shadow-[0_0_10px_#4F8CFF24]";

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
  useSyncExternalStore(
    subscribeToSettlementRecordChanges,
    getSettlementRecordSnapshot,
    getSettlementRecordSnapshot
  );
  const settlementRecords = listBrowserSettlementRecords();
  const platformRevenue = getPlatformRevenue(settlementRecords);
  const lastSuccessfulSettlement =
    getLastSuccessfulSettlement(settlementRecords);

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 shadow-sm shadow-black/10">
      <div className="flex items-center justify-center gap-3 text-left">
        <span className={iconBadgeClassName} aria-hidden="true">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5 19V9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M12 19V5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M19 19V12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>

        <div className="min-w-0">
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
      </div>
    </div>
  );
}
