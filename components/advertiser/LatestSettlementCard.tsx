"use client";

import { useState } from "react";

import type { SettlementRecord } from "@/lib/accounting/settlementRecords";
import {
  formatLastSettlementAmount,
  formatTransactionHash,
  getLastSuccessfulSettlement,
} from "@/lib/accounting/settlementSummary";
import { ARC_EXPLORER_URL } from "@/lib/arc/arcConstants";
import { MARKET_CONFIGS, SITE_CONFIGS } from "@/lib/auction/siteConfig";

type LatestSettlementCardProps = {
  settlementRecords: readonly SettlementRecord[];
};

function getSettlementSiteLabel(record: SettlementRecord) {
  const { marketId, siteId } = record.result;

  if (!marketId || !siteId) {
    return "Legacy settlement";
  }

  const siteConfig =
    SITE_CONFIGS.find(
      (site) => site.marketId === marketId && site.siteId === siteId
    ) ?? null;
  const marketName =
    MARKET_CONFIGS.find((market) => market.id === marketId)?.name ?? marketId;

  return siteConfig ? `${marketName} / ${siteConfig.name}` : `${marketId} / ${siteId}`;
}

export default function LatestSettlementCard({
  settlementRecords,
}: LatestSettlementCardProps) {
  const [isViewingMemo, setIsViewingMemo] = useState(false);
  const lastSuccessfulSettlement =
    getLastSuccessfulSettlement(settlementRecords);
  const lastSettlementSiteLabel = lastSuccessfulSettlement
    ? getSettlementSiteLabel(lastSuccessfulSettlement)
    : null;

  if (isViewingMemo && lastSuccessfulSettlement) {
    const memoRows = [
      ["Type", "pdooh.settlement"],
      ["Site", lastSettlementSiteLabel ?? "Unknown"],
      ["Settlement ID", lastSuccessfulSettlement.settlementId],
      ["Cycle", lastSuccessfulSettlement.result.cycleId],
      ["Slot", lastSuccessfulSettlement.result.slotId],
      ["Advertiser", lastSuccessfulSettlement.result.advertiserAddress],
      ["Company", lastSuccessfulSettlement.result.businessName],
      ["Ad", lastSuccessfulSettlement.result.advertisementName],
      [
        "Amount",
        `${formatLastSettlementAmount(
          lastSuccessfulSettlement.result.amountMinorUnits
        )} Test USDC`,
      ],
    ] as const;

    return (
      <div className="h-[220px] rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center shadow-sm shadow-black/10">
        <p className="text-[11px] font-medium uppercase tracking-widest text-white/40">
          Settlement Memo
        </p>

        <div className="mt-3 h-[144px] overflow-y-auto pr-1 text-left">
          {memoRows.map(([label, value]) => (
            <div
              key={label}
              className="border-t border-white/10 py-1.5 first:border-t-0 first:pt-0"
            >
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/35">
                {label}
              </p>
              <p className="mt-0.5 break-words font-mono text-[11px] leading-4 text-white/65">
                {value}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsViewingMemo(false)}
          className="mt-2 text-[11px] font-semibold text-emerald-300 underline-offset-2 hover:underline"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-[220px] rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center shadow-sm shadow-black/10">
      <p className="text-[11px] font-medium uppercase tracking-widest text-white/40">
        Latest Settlement
      </p>

      {lastSuccessfulSettlement ? (
        <>
          <p className="mt-1 text-base font-bold text-white">
            +{formatLastSettlementAmount(
              lastSuccessfulSettlement.result.amountMinorUnits
            )}{" "}
            Test USDC
          </p>
          {lastSettlementSiteLabel && (
            <p className="mt-1 text-xs font-semibold text-emerald-300">
              {lastSettlementSiteLabel}
            </p>
          )}

          {lastSuccessfulSettlement.txHash ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="break-all font-mono text-[11px] text-white/50">
                Tx: {formatTransactionHash(lastSuccessfulSettlement.txHash)}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                <a
                  href={`${ARC_EXPLORER_URL}/tx/${lastSuccessfulSettlement.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-emerald-300 underline-offset-2 hover:underline"
                >
                  View on Explorer
                </a>
                <button
                  type="button"
                  onClick={() => setIsViewingMemo(true)}
                  className="text-[11px] font-semibold text-emerald-300 underline-offset-2 hover:underline"
                >
                  View memo
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[11px] leading-4 text-white/40">
              No settlement transaction hash is available.
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-[11px] leading-4 text-white/40">
          No settlements yet.
        </p>
      )}
    </div>
  );
}
