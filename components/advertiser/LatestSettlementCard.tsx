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
import styles from "@/components/ui/OperationalPanel.module.css";

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
      <div className={`${styles.panel} h-[220px] px-4 py-3 text-center`}>
        <p className={styles.valueLabel}>
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
                <p className={styles.valueLabel}>
                  {label}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p
                    className={`break-words text-[11px] leading-4 text-white/70 ${
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
          className={`${styles.textAction} mt-2 text-[11px]`}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.panel} h-[220px] px-4 py-3 text-center`}>
      <p className={styles.valueLabel}>
        Account Revenue
      </p>

      <div className={`${styles.metric} mt-2 px-3 py-2`}>
        <p className={`${styles.valueText} font-mono text-sm tabular-nums`}>
          {formatSettlementRevenue(platformRevenue)} Test USDC
        </p>
      </div>

      {lastSuccessfulSettlement ? (
        <>
          <p className={`${styles.valuePositive} mt-2 font-mono text-base font-bold tabular-nums`}>
            +{formatLastSettlementAmount(
              lastSuccessfulSettlement.result.amountMinorUnits
            )}{" "}
            Test USDC
          </p>
          {lastSettlementSiteLabel && (
            <p className="mt-1 text-xs font-semibold text-white">
              {lastSettlementSiteLabel}
            </p>
          )}

          <div className={`${styles.eventPanel} mt-2 p-3`}>
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
                  className={`${styles.textAction} text-[11px]`}
                >
                  View on ArcScan
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setIsViewingMemo(true)}
                className={`${styles.textAction} text-[11px]`}
              >
                View memo
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className={`${styles.statusStrip} mt-3 px-3 py-2 text-[11px] leading-4`}>
          No settlements yet.
        </p>
      )}
    </div>
  );
}
