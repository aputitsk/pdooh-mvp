"use client";

import { useState } from "react";

import { depositEscrowFunds } from "@/lib/payments/paymentService";

type DepositStatus =
  | "idle"
  | "validating"
  | "approval_waiting"
  | "approval_pending"
  | "approval_confirmed"
  | "deposit_waiting"
  | "deposit_pending"
  | "success"
  | "error";

type EscrowDepositCardProps = {
  onSuccess: () => void;
  escrowBalance: string;
  escrowBalanceStatus: "idle" | "loading" | "ready" | "error";
  escrowBalanceError: string | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Escrow deposit failed.";
}

export default function EscrowDepositCard({
  onSuccess,
  escrowBalance,
  escrowBalanceStatus,
  escrowBalanceError,
}: EscrowDepositCardProps) {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [approvalTransactionHash, setApprovalTransactionHash] = useState<
    string | null
  >(null);
  const [depositTransactionHash, setDepositTransactionHash] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const isBusy =
    status === "validating" ||
    status === "approval_waiting" ||
    status === "approval_pending" ||
    status === "approval_confirmed" ||
    status === "deposit_waiting" ||
    status === "deposit_pending";

  async function handleDeposit() {
    setStatus("validating");
    setApprovalTransactionHash(null);
    setDepositTransactionHash(null);
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
      </div>

      <p className="mt-2 text-sm text-blue-100/70">
        This independent Arc Testnet flow requires two wallet transactions:
        exact USDC approval followed by an escrow deposit.
      </p>

      <p className="mt-2 text-sm text-blue-100/70">
        This custody balance is not connected to auction calculations yet.
      </p>

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

      <button
        type="button"
        onClick={handleDeposit}
        disabled={isBusy}
        className="mt-5 w-full rounded-full bg-blue-300 px-6 py-3 font-semibold text-black transition hover:bg-blue-200 disabled:cursor-wait disabled:bg-white/10 disabled:text-white/40"
      >
        {buttonLabel}
      </button>

      {approvalTransactionHash && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white/70">
            Approval transaction
          </p>

          <p className="mt-2 break-all font-mono text-xs text-white/50">
            {approvalTransactionHash}
          </p>
        </div>
      )}

      {depositTransactionHash && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white/70">
            Deposit transaction
          </p>

          <p className="mt-2 break-all font-mono text-xs text-white/50">
            {depositTransactionHash}
          </p>
        </div>
      )}

      {status === "success" && (
        <p className="mt-4 text-sm font-semibold text-emerald-300">
          Escrow deposit confirmed
        </p>
      )}

      {status === "error" && error && (
        <p className="mt-4 text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}