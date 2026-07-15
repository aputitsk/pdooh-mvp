"use client";

import { useEffect, useRef, useState } from "react";

import type { SettlementRecord } from "@/lib/accounting/settlementRecords";
import type { AccountRevenueSnapshot } from "@/lib/accounting/accountRevenueTypes";
import {
  formatLastSettlementAmount,
  formatSettlementRevenue,
  formatTransactionHash,
  getAccountSettlementRecords,
  getLastSuccessfulSettlement,
  getPlatformRevenue,
} from "@/lib/accounting/settlementSummary";
import { useAccountRevenueSnapshot } from "@/lib/accounting/useAccountRevenueSnapshot";
import { getArcScanTransactionUrl } from "@/lib/arc/arcScanUrls";
import { MARKET_CONFIGS, SITE_CONFIGS } from "@/lib/auction/siteConfig";
import MoneyAmount from "@/components/ui/MoneyAmount";
import CopyButton from "@/components/ui/CopyButton";
import styles from "@/components/ui/OperationalPanel.module.css";

type LatestSettlementCardProps = {
  accountAddress: string | null;
  settlementRecords: readonly SettlementRecord[];
};

type MemoRow = readonly [label: string, value: string];

function getSiteLabel(marketId: string, siteId: string) {
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

function getSettlementSiteLabel(record: SettlementRecord) {
  return getSiteLabel(record.result.marketId, record.result.siteId);
}

function getSnapshotSiteLabel(snapshot: AccountRevenueSnapshot) {
  const payment = snapshot.lastPayment;

  return payment ? getSiteLabel(payment.marketId, payment.siteId) : null;
}

function toSafeMinorUnits(value: string) {
  const amount = BigInt(value);

  return amount > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.MAX_SAFE_INTEGER
    : Number(amount);
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
  accountAddress,
  settlementRecords,
}: LatestSettlementCardProps) {
  const accountRevenue = useAccountRevenueSnapshot(accountAddress);
  const [isViewingMemo, setIsViewingMemo] = useState(false);
  const [isTransactionHashCopied, setIsTransactionHashCopied] =
    useState(false);
  const [isSettlementIdCopied, setIsSettlementIdCopied] = useState(false);
  const copyNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const accountSettlementRecords = getAccountSettlementRecords(
    settlementRecords,
    accountAddress
  );
  const lastSuccessfulSettlement =
    getLastSuccessfulSettlement(accountSettlementRecords);
  const revenueSnapshot = accountRevenue.snapshot;
  const displayedTransactionHash =
    revenueSnapshot?.lastPayment?.transactionHash ??
    lastSuccessfulSettlement?.txHash ??
    null;
  const platformRevenue = revenueSnapshot
    ? toSafeMinorUnits(revenueSnapshot.totalAmountMinorUnits)
    : getPlatformRevenue(accountSettlementRecords);
  const lastSettlementSiteLabel = revenueSnapshot
    ? getSnapshotSiteLabel(revenueSnapshot)
    : lastSuccessfulSettlement
      ? getSettlementSiteLabel(lastSuccessfulSettlement)
      : null;
  const lastSettlementAmount = revenueSnapshot?.lastPayment
    ? BigInt(revenueSnapshot.lastPayment.amountMinorUnits)
    : lastSuccessfulSettlement?.result.amountMinorUnits ?? null;
  const canViewMemo = Boolean(
    revenueSnapshot?.lastMemo || lastSuccessfulSettlement
  );
  const hasAccount = accountAddress !== null;
  const memoRows: readonly MemoRow[] | null = canViewMemo
    ? revenueSnapshot?.lastMemo
      ? ([
          ["Type", revenueSnapshot.lastMemo.type],
          ["Site", lastSettlementSiteLabel ?? "Unknown"],
          ["Settlement ID", revenueSnapshot.lastMemo.settlementId],
          ["Cycle", revenueSnapshot.lastMemo.cycleId],
          ["Slot", revenueSnapshot.lastMemo.slotId],
          ["Advertiser", revenueSnapshot.lastMemo.advertiser],
          ["Company", revenueSnapshot.lastMemo.company],
          ["Ad", revenueSnapshot.lastMemo.ad],
          [
            "Amount",
            formatLastSettlementAmount(
              BigInt(revenueSnapshot.lastMemo.amountMinor)
            ),
          ],
        ] as const)
      : ([
          ["Type", "pdooh.settlement"],
          ["Site", lastSettlementSiteLabel ?? "Unknown"],
          ["Settlement ID", lastSuccessfulSettlement?.settlementId ?? ""],
          ["Cycle", lastSuccessfulSettlement?.result.cycleId ?? ""],
          ["Slot", lastSuccessfulSettlement?.result.slotId ?? ""],
          [
            "Advertiser",
            lastSuccessfulSettlement?.result.advertiserAddress ?? "",
          ],
          ["Company", lastSuccessfulSettlement?.result.businessName ?? ""],
          ["Ad", lastSuccessfulSettlement?.result.advertisementName ?? ""],
          [
            "Amount",
            formatLastSettlementAmount(
              lastSuccessfulSettlement?.result.amountMinorUnits ?? BigInt(0)
            ),
          ],
        ] as const)
    : null;

  useEffect(() => {
    return () => {
      if (copyNoticeTimeoutRef.current) {
        clearTimeout(copyNoticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isViewingMemo) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsViewingMemo(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isViewingMemo]);

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

  return (
    <>
      <div className={`${styles.panel} h-[220px] px-4 py-3 text-center`}>
        <p className={styles.valueLabel}>
          Account Revenue
        </p>

      <div className={`${styles.metric} mt-2 px-3 py-2`}>
        <p className={`${styles.valueText} font-mono text-sm tabular-nums`}>
          <span className="mr-2 align-baseline text-[10px] font-semibold uppercase tracking-widest text-white/35">
            Total
          </span>
          <MoneyAmount
            amount={hasAccount ? formatSettlementRevenue(platformRevenue) : "-"}
            unit="Test USDC"
          />
        </p>
      </div>

      {!hasAccount ? (
        <p className={`${styles.statusStrip} mt-3 px-3 py-2 text-[11px] leading-4`}>
          Login to view account revenue.
        </p>
      ) : lastSettlementAmount !== null ? (
        <>
          <p className={`${styles.valuePositive} mt-2 font-mono text-base font-bold tabular-nums`}>
            <MoneyAmount
              amount={`+${formatLastSettlementAmount(lastSettlementAmount)}`}
              unit="Test USDC"
            />
          </p>
          {lastSettlementSiteLabel && (
            <p className="mt-1 text-xs font-semibold text-white">
              {lastSettlementSiteLabel}
            </p>
          )}

          <div className={`${styles.eventPanel} mt-2 p-3`}>
            {displayedTransactionHash ? (
              <div className="flex items-center justify-center gap-2">
                <p className="text-[11px] text-white/50">
                  Tx:{" "}
                  <span className="font-mono">
                    {formatTransactionHash(displayedTransactionHash)}
                  </span>
                </p>
                <CopyButton
                  ariaLabel="Copy settlement transaction hash"
                  onClick={() =>
                    void handleCopyTransactionHash(displayedTransactionHash)
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
            ) : null}

            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {displayedTransactionHash ? (
                <a
                  href={getArcScanTransactionUrl(displayedTransactionHash)}
                  target="_blank"
                  rel="noreferrer"
                  className={`${styles.textAction} text-[11px]`}
                >
                  View on ArcScan
                </a>
              ) : null}
              {canViewMemo ? (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={isViewingMemo}
                  onClick={() => setIsViewingMemo(true)}
                  className={`${styles.textAction} text-[11px]`}
                >
                  View memo
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <p className={`${styles.statusStrip} mt-3 px-3 py-2 text-[11px] leading-4`}>
          No settlements yet.
        </p>
      )}
      </div>

      {isViewingMemo && memoRows ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          onClick={() => setIsViewingMemo(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settlement-memo-title"
            className={`${styles.panel} max-h-[min(420px,calc(100vh-3rem))] w-full max-w-md px-4 py-3 text-center shadow-2xl shadow-black/50`}
            onClick={(event) => event.stopPropagation()}
          >
            <p id="settlement-memo-title" className={styles.valueLabel}>
              Settlement Memo
            </p>

            <div className="mt-3 max-h-[320px] overflow-y-auto pr-1 text-left">
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
                        {label === "Amount" ? (
                          <MoneyAmount
                            amount={value}
                            unit="Test USDC"
                          />
                        ) : (
                          value
                        )}
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
          </div>
        </div>
      ) : null}
    </>
  );
}
