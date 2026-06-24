"use client";

import { useState } from "react";

import { sendTreasuryPayment } from "@/lib/payments/paymentService";

type TransferStatus =
  | "idle"
  | "validating"
  | "waiting_for_wallet"
  | "pending"
  | "success"
  | "error";

type TreasuryTransferCardProps = {
  onSuccess: () => void;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "USDC transfer failed.";
}

export default function TreasuryTransferCard({
  onSuccess,
}: TreasuryTransferCardProps) {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<TransferStatus>("idle");
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isBusy =
    status === "validating" ||
    status === "waiting_for_wallet" ||
    status === "pending";

  async function handleTransfer() {
    setStatus("validating");
    setTransactionHash(null);
    setError(null);

    try {
      const hash = await sendTreasuryPayment(amount, {
        onWaitingForWallet() {
          setStatus("waiting_for_wallet");
        },
        onPending(pendingHash) {
          setTransactionHash(pendingHash);
          setStatus("pending");
        },
      });

      setTransactionHash(hash);
      setStatus("success");
      setAmount("");
      onSuccess();
    } catch (transferError) {
      setStatus("error");
      setError(getErrorMessage(transferError));
    }
  }

  return (
    <div className="rounded-3xl border border-amber-400/30 bg-amber-400/[0.06] p-6">
      <h2 className="text-xl font-bold">Send real USDC to pDOOH Treasury</h2>

      <p className="mt-2 text-sm text-amber-100/70">
        Warning: this submits a real Arc Testnet transaction from your
        connected external wallet.
      </p>

      <label className="mt-5 block text-sm text-white/60" htmlFor="treasury-usdc">
        Amount in Test USDC
      </label>

      <input
        id="treasury-usdc"
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        disabled={isBusy}
        placeholder="1"
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none disabled:cursor-wait disabled:text-white/40"
      />

      <button
        type="button"
        onClick={handleTransfer}
        disabled={isBusy}
        className="mt-5 w-full rounded-full bg-amber-300 px-6 py-3 font-semibold text-black transition hover:bg-amber-200 disabled:cursor-wait disabled:bg-white/10 disabled:text-white/40"
      >
        {status === "validating"
          ? "Validating..."
          : status === "waiting_for_wallet"
            ? "Confirm in wallet..."
            : status === "pending"
              ? "Waiting for confirmation..."
              : "Send USDC"}
      </button>

      {status === "success" && transactionHash && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-300">
            Transfer confirmed
          </p>
          <p className="mt-2 break-all font-mono text-xs text-white/60">
            {transactionHash}
          </p>
        </div>
      )}

      {status === "pending" && transactionHash && (
        <p className="mt-4 break-all text-xs text-white/50">
          Transaction: {transactionHash}
        </p>
      )}

      {status === "error" && error && (
        <p className="mt-4 text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
