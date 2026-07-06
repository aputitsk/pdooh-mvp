"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  depositEscrowFunds,
  withdrawEscrowFunds,
} from "@/lib/payments/paymentService";
import {
  formatUSDCFromMinorUnits,
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";
import {
  getArcScanAddressUrl,
  getArcScanTransactionUrl,
} from "@/lib/arc/arcScanUrls";
import { getArcEscrowAddress } from "@/lib/arc/arcEscrowConfig";

type EscrowActionStatus =
  | "idle"
  | "validating"
  | "approval_waiting"
  | "approval_pending"
  | "approval_confirmed"
  | "deposit_waiting"
  | "deposit_pending"
  | "withdraw_waiting"
  | "withdraw_pending"
  | "success"
  | "withdraw_success"
  | "error";

type EscrowDepositCardProps = {
  onSuccess: () => void;
  escrowBalance: string;
  escrowBalanceMinorUnits: UsdcMinorUnits | null;
  escrowBalanceStatus: "idle" | "loading" | "ready" | "error";
  escrowBalanceError: string | null;
  reservedAmount: UsdcMinorUnits;
};

type ReceiptTransaction = {
  label: string;
  transactionHash: string;
  isCopied: boolean;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Escrow deposit failed.";
}

function formatOnchainReference(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatWideOnchainReference(value: string) {
  return `${value.slice(0, 18)}...${value.slice(-14)}`;
}

function getConfiguredEscrowAddress() {
  try {
    return getArcEscrowAddress();
  } catch {
    return null;
  }
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-3.5 w-3.5"
    >
      <path
        d="M7 7.5A1.5 1.5 0 0 1 8.5 6h6A1.5 1.5 0 0 1 16 7.5v6a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 7 13.5v-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4 12.5v-7A1.5 1.5 0 0 1 5.5 4h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-3.5 w-3.5"
    >
      <path
        d="M8 5H5.5A1.5 1.5 0 0 0 4 6.5v8A1.5 1.5 0 0 0 5.5 16h8a1.5 1.5 0 0 0 1.5-1.5V12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M11 4h5v5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m10 10 5.5-5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TransactionReceiptRow({
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
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
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
          <button
            type="button"
            aria-label={`Copy ${label.toLowerCase()} transaction hash`}
            onClick={onCopy}
            className="rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
          >
            <CopyIcon />
          </button>
          <a
            href={getArcScanTransactionUrl(transactionHash)}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-emerald-300 underline-offset-2 hover:underline"
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

function TransactionReceipt({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      id="escrow-transaction-receipt"
      className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35">
          Transaction receipt
        </p>
        <p className="text-[11px] font-semibold text-white/40">
          Arc Testnet
        </p>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

export default function EscrowDepositCard({
  onSuccess,
  escrowBalance,
  escrowBalanceMinorUnits,
  escrowBalanceStatus,
  escrowBalanceError,
  reservedAmount,
}: EscrowDepositCardProps) {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<EscrowActionStatus>("idle");
  const [approvalTransactionHash, setApprovalTransactionHash] = useState<
    string | null
  >(null);
  const [depositTransactionHash, setDepositTransactionHash] = useState<
    string | null
  >(null);
  const [withdrawTransactionHash, setWithdrawTransactionHash] = useState<
    string | null
  >(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [copiedOnchainReference, setCopiedOnchainReference] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const copyNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const isBusy =
    status === "validating" ||
    status === "approval_waiting" ||
    status === "approval_pending" ||
    status === "approval_confirmed" ||
    status === "deposit_waiting" ||
    status === "deposit_pending" ||
    status === "withdraw_waiting" ||
    status === "withdraw_pending";
  const canWithdraw =
    escrowBalanceStatus === "ready" &&
    escrowBalanceMinorUnits !== null &&
    escrowBalanceMinorUnits > 0 &&
    reservedAmount === 0;
  const escrowContractAddress = getConfiguredEscrowAddress();

  useEffect(() => {
    return () => {
      if (copyNoticeTimeoutRef.current) {
        clearTimeout(copyNoticeTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopyOnchainReference(value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedOnchainReference(value);

    if (copyNoticeTimeoutRef.current) {
      clearTimeout(copyNoticeTimeoutRef.current);
    }

    copyNoticeTimeoutRef.current = setTimeout(() => {
      setCopiedOnchainReference(null);
    }, 1600);
  }

  async function handleDeposit() {
    setStatus("validating");
    setApprovalTransactionHash(null);
    setDepositTransactionHash(null);
    setWithdrawTransactionHash(null);
    setIsReceiptOpen(false);
    setError(null);

    try {
      const result = await depositEscrowFunds(amount, {
        onApprovalWalletRequest() {
          setStatus("approval_waiting");
        },
        onApprovalPending(transactionHash) {
          setApprovalTransactionHash(transactionHash);
          setStatus("approval_pending");
        },
        onApprovalConfirmed(transactionHash) {
          setApprovalTransactionHash(transactionHash);
          setStatus("approval_confirmed");
        },
        onDepositWalletRequest() {
          setStatus("deposit_waiting");
        },
        onDepositPending(transactionHash) {
          setDepositTransactionHash(transactionHash);
          setStatus("deposit_pending");
        },
      });

      setApprovalTransactionHash(result.approvalTransactionHash);
      setDepositTransactionHash(result.depositTransactionHash);
      setStatus("success");
      setAmount("");
      onSuccess();
    } catch (depositError) {
      setStatus("error");
      setError(getErrorMessage(depositError));
    }
  }

  async function handleWithdraw() {
    setStatus("validating");
    setApprovalTransactionHash(null);
    setDepositTransactionHash(null);
    setWithdrawTransactionHash(null);
    setIsReceiptOpen(false);
    setError(null);

    try {
      const withdrawAmount = parseUSDCToMinorUnits(amount);

      if (reservedAmount > 0) {
        throw new Error("Withdraw is disabled while funds are reserved.");
      }

      if (withdrawAmount <= 0) {
        throw new Error("Enter an escrow withdraw amount greater than zero.");
      }

      if (
        escrowBalanceStatus !== "ready" ||
        escrowBalanceMinorUnits === null ||
        escrowBalanceMinorUnits <= 0
      ) {
        throw new Error("No escrow balance is available to withdraw.");
      }

      if (withdrawAmount > escrowBalanceMinorUnits) {
        throw new Error("Withdraw amount exceeds your escrow balance.");
      }

      const result = await withdrawEscrowFunds(amount, {
        onWithdrawWalletRequest() {
          setStatus("withdraw_waiting");
        },
        onWithdrawPending(transactionHash) {
          setWithdrawTransactionHash(transactionHash);
          setStatus("withdraw_pending");
        },
      });

      setWithdrawTransactionHash(result.withdrawTransactionHash);
      setStatus("withdraw_success");
      setAmount("");
      onSuccess();
    } catch (withdrawError) {
      setStatus("error");
      setError(getErrorMessage(withdrawError));
    }
  }

  const buttonLabel =
    status === "validating"
      ? "Validating escrow..."
      : status === "approval_waiting"
        ? "Confirm approval in wallet..."
        : status === "approval_pending"
          ? "Waiting for approval..."
          : status === "approval_confirmed" ||
              status === "deposit_waiting"
            ? "Confirm deposit in wallet..."
            : status === "deposit_pending"
              ? "Waiting for deposit..."
              : "Deposit to Escrow";
  const withdrawButtonLabel =
    status === "withdraw_waiting"
      ? "Confirm withdraw in wallet..."
      : status === "withdraw_pending"
        ? "Waiting for withdraw..."
        : "Withdraw";

  const escrowBalanceText =
    escrowBalanceStatus === "ready"
      ? `${escrowBalance} Test USDC`
      : escrowBalanceStatus === "loading"
        ? "Reading escrow balance..."
        : escrowBalanceStatus === "error"
          ? escrowBalanceError
          : "Connect wallet to read escrow balance";
  const receiptTransactions: ReceiptTransaction[] = [];

  if (approvalTransactionHash) {
    receiptTransactions.push({
      label: "Approval",
      transactionHash: approvalTransactionHash,
      isCopied: copiedOnchainReference === approvalTransactionHash,
    });
  }

  if (depositTransactionHash) {
    receiptTransactions.push({
      label: "Deposit",
      transactionHash: depositTransactionHash,
      isCopied: copiedOnchainReference === depositTransactionHash,
    });
  }

  if (withdrawTransactionHash) {
    receiptTransactions.push({
      label: "Withdraw",
      transactionHash: withdrawTransactionHash,
      isCopied: copiedOnchainReference === withdrawTransactionHash,
    });
  }

  const hasReceiptTransactions = receiptTransactions.length > 0;
  const confirmationMessage =
    status === "success"
      ? "Escrow deposit confirmed"
      : status === "withdraw_success"
        ? "Escrow withdraw confirmed"
        : null;

  return (
    <div className="rounded-3xl border border-blue-400/30 bg-blue-400/[0.06] p-6">
      <p className="text-sm font-medium text-white/40">Step 3</p>

      <h2 className="mt-2 text-xl font-bold">
        Escrow Deposit Test USDC
      </h2>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm text-white/50">Escrow Balance</p>

        <p className="mt-1 break-words font-semibold text-white/80">
          {escrowBalanceText}
        </p>

        <p className="mt-2 text-xs text-white/40">
          Custodied in AuctionEscrow and separate from the external wallet
          balance.
        </p>

        {escrowContractAddress ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/45">
            <span>AuctionEscrow:</span>
            <span className="font-mono text-white/60">
              {formatOnchainReference(escrowContractAddress)}
            </span>
            <button
              type="button"
              aria-label="Copy AuctionEscrow address"
              onClick={() =>
                void handleCopyOnchainReference(escrowContractAddress)
              }
              className="rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
            >
              <CopyIcon />
            </button>
            <a
              href={getArcScanAddressUrl(escrowContractAddress)}
              target="_blank"
              rel="noreferrer"
              aria-label="View AuctionEscrow on ArcScan"
              className="rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
            >
              <ExternalLinkIcon />
            </a>
            {copiedOnchainReference === escrowContractAddress ? (
              <span
                role="status"
                aria-live="polite"
                className="font-semibold text-emerald-300"
              >
                Copied
              </span>
            ) : null}
          </div>
        ) : null}

        {reservedAmount > 0 && (
          <p className="mt-2 text-xs font-medium text-amber-200">
            Reserved for active bids and unresolved settlements:{" "}
            {formatUSDCFromMinorUnits(reservedAmount)} Test USDC
          </p>
        )}
      </div>

      <label
        className="mt-5 block text-sm text-white/60"
        htmlFor="escrow-usdc"
      >
        Amount in Test USDC
      </label>

      <input
        id="escrow-usdc"
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        disabled={isBusy}
        placeholder="1"
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none disabled:cursor-wait disabled:text-white/40"
      />

      <div
        className={
          canWithdraw
            ? "mt-5 flex flex-col gap-3 sm:flex-row"
            : "mt-5"
        }
      >
        <button
          type="button"
          onClick={handleDeposit}
          disabled={isBusy}
          className="min-h-12 w-full rounded-full bg-blue-300 px-6 py-3 font-semibold text-black transition hover:bg-blue-200 disabled:cursor-wait disabled:bg-white/10 disabled:text-white/40"
        >
          {buttonLabel}
        </button>

        {canWithdraw && (
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={isBusy}
            className="min-h-12 w-full rounded-full border border-white/10 bg-black/30 px-6 py-3 font-semibold text-white/80 transition hover:border-white/25 hover:bg-white/10 disabled:cursor-wait disabled:border-white/10 disabled:bg-white/10 disabled:text-white/40"
          >
            {withdrawButtonLabel}
          </button>
        )}
      </div>

      {confirmationMessage ? (
        <div className="mt-4 flex items-center gap-2 overflow-x-auto whitespace-nowrap text-sm font-semibold">
          <span className="text-emerald-300">{confirmationMessage}</span>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[11px] text-emerald-200">
            Final on Arc Testnet
          </span>
          {hasReceiptTransactions ? (
            <button
              type="button"
              aria-expanded={isReceiptOpen}
              aria-controls="escrow-transaction-receipt"
              onClick={() => setIsReceiptOpen((isOpen) => !isOpen)}
              className="text-sm font-semibold text-emerald-300 underline-offset-2 hover:underline"
            >
              {isReceiptOpen ? "Hide receipt" : "View receipt"}
            </button>
          ) : null}
        </div>
      ) : hasReceiptTransactions ? (
        <div className="mt-4 flex items-center">
          <button
            type="button"
            aria-expanded={isReceiptOpen}
            aria-controls="escrow-transaction-receipt"
            onClick={() => setIsReceiptOpen((isOpen) => !isOpen)}
            className="text-sm font-semibold text-emerald-300 underline-offset-2 hover:underline"
          >
            {isReceiptOpen ? "Hide receipt" : "View receipt"}
          </button>
        </div>
      ) : null}

      {hasReceiptTransactions && isReceiptOpen ? (
        <TransactionReceipt>
          {receiptTransactions.map((transaction) => (
            <TransactionReceiptRow
              key={`${transaction.label}-${transaction.transactionHash}`}
              label={transaction.label}
              transactionHash={transaction.transactionHash}
              isCopied={transaction.isCopied}
              onCopy={() =>
                void handleCopyOnchainReference(transaction.transactionHash)
              }
            />
          ))}
        </TransactionReceipt>
      ) : null}

      {status === "error" && error && (
        <p className="mt-4 text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
