"use client";

import { useEffect, useRef, useState } from "react";

import type { SettlementRecord } from "@/lib/accounting/settlementRecords";
import {
  formatLastSettlementAmount,
  formatSettlementRevenue,
  formatTransactionHash,
  getLastSuccessfulSettlement,
  getPlatformRevenue,
} from "@/lib/accounting/settlementSummary";
import { getArcScanTransactionUrl } from "@/lib/arc/arcScanUrls";
import { MARKET_CONFIGS, SITE_CONFIGS } from "@/lib/auction/siteConfig";
import CopyButton from "@/components/ui/CopyButton";

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

function isMemoValueMonospace(label: string) {
  return (
    label === "Settlement ID" ||
    label === "Cycle" ||
    label === "Slot" ||
    label === "Advertiser" ||
    label === "Amount"
  );
}

export default function LatestSettlementCard({
  settlementRecords,
}: LatestSettlementCardProps) {
  const [isViewingMemo, setIsViewingMemo] = useState(false);
  const [isTransactionHashCopied, setIsTransactionHashCopied] =
    useState(false);
  const [isSettlementIdCopied, setIsSettlementIdCopied] = useState(false);
  const copyNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastSuccessfulSettlement =
    getLastSuccessfulSettlement(settlementRecords);
  const platformRevenue = getPlatformRevenue(settlementRecords);
  const lastSettlementSiteLabel = lastSuccessfulSettlement
    ? getSettlementSiteLabel(lastSuccessfulSettlement)
    : null;

  useEffect(() => {
    return () => {
      if (copyNoticeTimeoutRef.current) {
        clearTimeout(copyNoticeTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopyTransactionHash(transactionHash: string) {
    await navigator.clipboard.writeText(transactionHash);
    setIsTransactionHashCopied(true);

    if (copyNoticeTimeoutRef.current) {
      clearTimeout(copyNoticeTimeoutRef.current);
    }

    copyNoticeTimeoutRef.current = setTimeout(() => {
      setIsTransactionHashCopied(false);
    }, 1600);
  }

  async function handleCopySettlementId(settlementId: string) {
    await navigator.clipboard.writeText(settlementId);
    setIsSettlementIdCopied(true);

    if (copyNoticeTimeoutRef.current) {
      clearTimeout(copyNoticeTimeoutRef.current);
    }

    copyNoticeTimeoutRef.current = setTimeout(() => {
      setIsSettlementIdCopied(false);
    }, 1600);
  }

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
          {memoRows.map(([label, value]) => {
            const isSettlementId = label === "Settlement ID";
            const isMonospaceValue = isMemoValueMonospace(label);

            return (
              <div
                key={label}
                className="border-t border-white/10 py-1.5 first:border-t-0 first:pt-0"
              >
                <p className="text-[10px] font-medium uppercase tracking-widest text-white/35">
                  {label}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p
                    className={`break-words text-[11px] leading-4 text-white/65 ${
                      isMonospaceValue ? "font-mono tabular-nums" : ""
                    }`}
                  >
                    {value}
                  </p>
                  {isSettlementId ? (
                    <>
                      <CopyButton
                        ariaLabel="Copy settlement ID"
                        onClick={() => void handleCopySettlementId(value)}
                        className="shrink-0 rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
                      />
                      {isSettlementIdCopied ? (
                        <span
                          role="status"
                          aria-live="polite"
                          className="shrink-0 text-[10px] font-semibold text-emerald-300"
                        >
                          Copied
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
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
        [Account Revenue] - [Latest Settlement] - [Memo]
      </p>

      <div className="mt-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
        <p className="font-mono text-sm font-bold tabular-nums text-white">
          {formatSettlementRevenue(platformRevenue)} Test USDC
        </p>
      </div>

      {lastSuccessfulSettlement ? (
        <>
          <p className="mt-2 font-mono text-base font-bold tabular-nums text-white">
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

          <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3">
            {lastSuccessfulSettlement.txHash ? (
              <div className="flex items-center justify-center gap-2">
                <p className="text-[11px] text-white/50">
                  Tx:{" "}
                  <span className="font-mono">
                    {formatTransactionHash(lastSuccessfulSettlement.txHash)}
                  </span>
                </p>
                <CopyButton
                  ariaLabel="Copy settlement transaction hash"
                  onClick={() =>
                    void handleCopyTransactionHash(
                      lastSuccessfulSettlement.txHash ?? ""
                    )
                  }
                  className="rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
                />
                {isTransactionHashCopied ? (
                  <span
                    role="status"
                    aria-live="polite"
                    className="text-[10px] font-semibold text-emerald-300"
                  >
                    Copied
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="text-[11px] leading-4 text-white/40">
                No settlement transaction hash is available.
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {lastSuccessfulSettlement.txHash ? (
                <a
                  href={getArcScanTransactionUrl(lastSuccessfulSettlement.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-emerald-300 underline-offset-2 hover:underline"
                >
                  View on ArcScan
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setIsViewingMemo(true)}
                className="text-[11px] font-semibold text-emerald-300 underline-offset-2 hover:underline"
              >
                View memo
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-3 text-[11px] leading-4 text-white/40">
          No settlements yet.
        </p>
      )}
    </div>
  );
}
