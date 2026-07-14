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
  getAccountSettlementRecords,
  getLastSuccessfulSettlement,
  getPlatformRevenue,
} from "@/lib/accounting/settlementSummary";
import { useWalletStore } from "@/lib/wallet";
import MoneyAmount from "@/components/ui/MoneyAmount";

const subscribeToHydration = () => () => {};
const getHydratedSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export default function TreasuryBalanceWidget() {
  const wallet = useWalletStore();
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
  const accountSettlementRecords = getAccountSettlementRecords(
    settlementRecords,
    wallet.address
  );
  const accountRevenue = getPlatformRevenue(accountSettlementRecords);
  const lastSuccessfulSettlement =
    getLastSuccessfulSettlement(accountSettlementRecords);
  const hasAccount = wallet.connected && wallet.address !== null;

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center shadow-sm shadow-black/10">
      <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">
        Account Revenue
      </p>
      <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-white">
        <span className="mr-1.5 align-baseline text-[9px] font-semibold uppercase tracking-widest text-white/35">
          Total
        </span>
        <MoneyAmount
          amount={hasAccount ? formatSettlementRevenue(accountRevenue) : "-"}
          unit="Test USDC"
        />
      </p>
      <p
        className={`mt-0.5 text-[10px] leading-4 ${
          lastSuccessfulSettlement ? "text-emerald-400" : "text-white/35"
        }`}
      >
        {!hasAccount ? (
          "Login to view revenue"
        ) : lastSuccessfulSettlement ? (
          <>
            <span className="font-mono tabular-nums">
              <MoneyAmount
                amount={`+${formatLastSettlementAmount(
                  lastSuccessfulSettlement.result.amountMinorUnits
                )}`}
                unit="USDC"
              />
            </span>{" "}
            Last settlement
          </>
        ) : (
          "No settlements yet"
        )}
      </p>
    </div>
  );
}
