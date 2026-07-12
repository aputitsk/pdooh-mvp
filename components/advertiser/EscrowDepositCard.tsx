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
import styles from "@/components/ui/OperationalPanel.module.css";

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
    <div className={`${styles.panel} ${styles.panelWarning} p-6`}>
      <p className={styles.eyebrow}>Step 3</p>

      <h2 className={`${styles.title} mt-2 text-xl font-bold`}>
        Escrow Deposit Test USDC
      </h2>

      <div className={`${styles.metric} mt-5 p-4`}>
        <p className={styles.valueLabel}>Escrow Balance</p>

        <p
          className={`${styles.valueText} mt-2 break-words text-lg ${
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
          <p className={`${styles.statusStrip} ${styles.statusStripWarning} mt-3 px-3 py-2 text-xs font-medium`}>
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
        className={`${styles.field} mt-2 w-full px-4 py-3 font-mono tabular-nums disabled:cursor-wait`}
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
          className={`${styles.primaryAction} min-h-12 w-full px-6 py-3 font-semibold disabled:cursor-wait`}
        >
          {buttonLabel}
        </button>

        {canWithdraw && (
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={isBusy}
            className={`${styles.secondaryAction} min-h-12 w-full px-6 py-3 font-semibold disabled:cursor-wait`}
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
            className={`${styles.textAction} text-sm`}
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
        <p className={`${styles.statusStrip} ${styles.statusStripError} mt-4 px-3 py-2 text-sm font-medium`}>
          {error}
        </p>
      )}
    </div>
  );
}
