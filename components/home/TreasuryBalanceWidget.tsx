"use client";

import { useSyncExternalStore } from "react";
import {
  getSettlementRecordSnapshot,
  listBrowserSettlementRecords,
  subscribeToSettlementRecordChanges,
} from "@/lib/accounting/settlementRecordSync";
import {
  formatLastSettlementAmount,
  formatSettlementRevenue,
  getLastSuccessfulSettlement,
  getPlatformRevenue,
} from "@/lib/accounting/settlementSummary";

const subscribeToHydration = () => () => {};
const getHydratedSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

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
        Account Revenue
      </p>
      <p className="mt-0.5 text-sm font-bold text-white">
        {formatSettlementRevenue(platformRevenue)} Test USDC
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
