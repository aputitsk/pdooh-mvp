import type { ReactNode } from "react";

import CopyButton from "@/components/ui/CopyButton";
import ExternalLinkButton from "@/components/ui/ExternalLinkButton";
import {
  getArcScanAddressUrl,
  getArcScanTransactionUrl,
} from "@/lib/arc/arcScanUrls";
import styles from "@/components/ui/OperationalPanel.module.css";

export function formatOnchainReference(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatWideOnchainReference(value: string) {
  return `${value.slice(0, 18)}...${value.slice(-14)}`;
}

export function EscrowAddressRow({
  escrowContractAddress,
  isCopied,
  onCopy,
}: {
  escrowContractAddress: string;
  isCopied: boolean;
  onCopy: (value: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/45">
      <span>AuctionEscrow:</span>
      <span className="font-mono text-white/60">
        {formatOnchainReference(escrowContractAddress)}
      </span>
      <CopyButton
        ariaLabel="Copy AuctionEscrow address"
        onClick={() => onCopy(escrowContractAddress)}
        className="rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
      />
      <ExternalLinkButton
        href={getArcScanAddressUrl(escrowContractAddress)}
        ariaLabel="View AuctionEscrow on ArcScan"
        className="rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
      />
      {isCopied ? (
        <span
          role="status"
          aria-live="polite"
          className="font-semibold text-emerald-300"
        >
          Copied
        </span>
      ) : null}
    </div>
  );
}

export function TransactionReceiptRow({
  label,
  transactionHash,
  isCopied,
  onCopy,
}: {
  label: string;
  transactionHash: string;
  isCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className={`${styles.eventPanel} px-3 py-2`}>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs font-semibold text-white/70">
            {label}
          </span>
          <span className="font-mono text-xs text-white/55 md:hidden">
            {formatOnchainReference(transactionHash)}
          </span>
          <span
            className="hidden min-w-0 truncate font-mono text-xs text-white/55 md:inline"
            title={transactionHash}
          >
            {formatWideOnchainReference(transactionHash)}
          </span>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1">
          <CopyButton
            ariaLabel={`Copy ${label.toLowerCase()} transaction hash`}
            onClick={onCopy}
            className="rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
          />
          <a
            href={getArcScanTransactionUrl(transactionHash)}
            target="_blank"
            rel="noreferrer"
            className={`${styles.textAction} text-xs`}
          >
            ArcScan
          </a>
          {isCopied ? (
            <span
              role="status"
              aria-live="polite"
              className="text-[11px] font-semibold text-emerald-300"
            >
              Copied
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function TransactionReceipt({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      id="escrow-transaction-receipt"
      className={`${styles.eventPanel} mt-3 p-3`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={styles.valueLabel}>
          Transaction receipt
        </p>
        <p className="text-[11px] font-semibold text-white/45">
          Arc Testnet
        </p>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {children}
      </div>
    </div>
  );
}
