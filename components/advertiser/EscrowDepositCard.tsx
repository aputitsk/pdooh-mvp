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
import { getArcEscrowAddress } from "@/lib/arc/arcEscrowConfig";
import {
  EscrowAddressRow,
  TransactionReceipt,
  TransactionReceiptRow,
} from "@/components/advertiser/EscrowReceipt";
import { showSuccess } from "@/components/ui/SuccessToastProvider";

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

function getConfiguredEscrowAddress() {
  try {
    return getArcEscrowAddress();
  } catch {
    return null;
  }
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
      showSuccess("Deposit confirmed");
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
      showSuccess("Withdrawal confirmed");
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
  return (
    <div className="rounded-3xl border border-blue-400/30 bg-blue-400/[0.06] p-6">
      <p className="text-sm font-medium text-white/40">Step 3</p>

      <h2 className="mt-2 text-xl font-bold text-[#CFE8FF]">
        Escrow Deposit Test USDC
      </h2>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm text-white/50">Escrow Balance</p>

        <p
          className={`mt-1 break-words font-semibold text-white/80 ${
            escrowBalanceStatus === "ready" ? "font-mono tabular-nums" : ""
          }`}
        >
          {escrowBalanceText}
        </p>

        <p className="mt-2 text-xs text-white/40">
          Custodied in AuctionEscrow and separate from the external wallet
          balance.
        </p>

        {escrowContractAddress ? (
          <EscrowAddressRow
            escrowContractAddress={escrowContractAddress}
            isCopied={copiedOnchainReference === escrowContractAddress}
            onCopy={(value) => void handleCopyOnchainReference(value)}
          />
        ) : null}

        {reservedAmount > 0 && (
          <p className="mt-2 text-xs font-medium text-amber-200">
            Reserved for active bids and unresolved settlements:{" "}
            <span className="font-mono tabular-nums">
              {formatUSDCFromMinorUnits(reservedAmount)} Test USDC
            </span>
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
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono tabular-nums text-white outline-none disabled:cursor-wait disabled:text-white/40"
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

      {hasReceiptTransactions ? (
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
