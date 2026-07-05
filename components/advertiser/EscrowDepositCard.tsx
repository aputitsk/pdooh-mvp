"use client";

import { useEffect, useRef, useState } from "react";

import {
  depositEscrowFunds,
  withdrawEscrowFunds,
} from "@/lib/payments/paymentService";
import {
  formatUSDCFromMinorUnits,
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";
import { getArcScanTransactionUrl } from "@/lib/arc/arcScanUrls";

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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Escrow deposit failed.";
}

function formatTransactionHash(transactionHash: string) {
  return `${transactionHash.slice(0, 6)}...${transactionHash.slice(-4)}`;
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

function TransactionReceiptRow({
  label,
  transactionHash,
  isCopied,
  onCopy,
}: {
  label: string;
  transactionHash: string;
  isCopied: boolean;
  onCopy: (transactionHash: string) => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm font-semibold text-white/70">{label}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-white/55">
          {formatTransactionHash(transactionHash)}
        </span>
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()} hash`}
          onClick={() => onCopy(transactionHash)}
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
          View on ArcScan
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
  const [copiedTransactionHash, setCopiedTransactionHash] = useState<
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

  useEffect(() => {
    return () => {
      if (copyNoticeTimeoutRef.current) {
        clearTimeout(copyNoticeTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopyTransactionHash(transactionHash: string) {
    await navigator.clipboard.writeText(transactionHash);
    setCopiedTransactionHash(transactionHash);

    if (copyNoticeTimeoutRef.current) {
      clearTimeout(copyNoticeTimeoutRef.current);
    }

    copyNoticeTimeoutRef.current = setTimeout(() => {
      setCopiedTransactionHash(null);
    }, 1600);
  }

  async function handleDeposit() {
    setStatus("validating");
    setApprovalTransactionHash(null);
    setDepositTransactionHash(null);
    setWithdrawTransactionHash(null);
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

      {approvalTransactionHash && (
        <TransactionReceiptRow
          label="Approval transaction"
          transactionHash={approvalTransactionHash}
          isCopied={copiedTransactionHash === approvalTransactionHash}
          onCopy={(transactionHash) =>
            void handleCopyTransactionHash(transactionHash)
          }
        />
      )}

      {depositTransactionHash && (
        <TransactionReceiptRow
          label="Deposit transaction"
          transactionHash={depositTransactionHash}
          isCopied={copiedTransactionHash === depositTransactionHash}
          onCopy={(transactionHash) =>
            void handleCopyTransactionHash(transactionHash)
          }
        />
      )}

      {withdrawTransactionHash && (
        <TransactionReceiptRow
          label="Withdraw transaction"
          transactionHash={withdrawTransactionHash}
          isCopied={copiedTransactionHash === withdrawTransactionHash}
          onCopy={(transactionHash) =>
            void handleCopyTransactionHash(transactionHash)
          }
        />
      )}

      {status === "success" && (
        <p className="mt-4 text-sm font-semibold text-emerald-300">
          Escrow deposit confirmed
        </p>
      )}

      {status === "withdraw_success" && (
        <p className="mt-4 text-sm font-semibold text-emerald-300">
          Escrow withdraw confirmed
        </p>
      )}

      {status === "error" && error && (
        <p className="mt-4 text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
