"use client";

import { useEffect, useState } from "react";
import type { Advertisement, AuctionPhase } from "@/lib/auction";
import {
  AUCTION_PLAYBACK_SECONDS_PER_SLOT,
  DEMO_BOT_ADVERTISEMENT,
} from "@/lib/auction/constants";
import {
  formatUSDCFromMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

const PLAYBACK_SLOT_DURATION_MS = AUCTION_PLAYBACK_SECONDS_PER_SLOT * 1000;

type AuctionStatusCardProps = {
  phase: AuctionPhase | "selecting";
  slotSecondsRemaining: number;
  currentSlotIndex: number;
  walletBalance: string;
  walletBalanceStatus: "idle" | "loading" | "ready" | "error";
  walletBalanceError: string | null;
  escrowBalance: UsdcMinorUnits | null;
  availableAuctionCapacity: UsdcMinorUnits;
  reservedAmount: UsdcMinorUnits;
  escrowBalanceStatus: "idle" | "loading" | "ready" | "error";
  escrowBalanceError: string | null;
  winners: Advertisement[];
};

function isDemoBotAdvertisement(winner: Advertisement) {
  return winner.businessName === DEMO_BOT_ADVERTISEMENT.businessName;
}

export default function AuctionStatusCard({
  phase,
  slotSecondsRemaining,
  currentSlotIndex,
  walletBalance,
  walletBalanceStatus,
  walletBalanceError,
  escrowBalance,
  availableAuctionCapacity,
  reservedAmount,
  escrowBalanceStatus,
  escrowBalanceError,
  winners,
}: AuctionStatusCardProps) {
  const [playbackNowMs, setPlaybackNowMs] = useState(0);
  const walletBalanceText =
    walletBalanceStatus === "ready"
      ? `${walletBalance} Test USDC`
      : walletBalanceStatus === "loading"
        ? "Reading balance..."
        : walletBalanceStatus === "error"
          ? walletBalanceError
          : "Connect wallet";
  const escrowBalanceText =
    escrowBalanceStatus === "ready" && escrowBalance !== null
      ? `${formatUSDCFromMinorUnits(escrowBalance)} Test USDC`
      : escrowBalanceStatus === "loading"
        ? "Reading balance..."
        : escrowBalanceStatus === "error"
          ? escrowBalanceError
          : "Connect wallet";
  const shouldShowWinners = phase !== "open";
  const isLive = phase === "live";

  useEffect(() => {
    if (!isLive) {
      return;
    }

    const interval = window.setInterval(() => {
      setPlaybackNowMs(Date.now());
    }, 33);

    return () => {
      window.clearInterval(interval);
    };
  }, [isLive]);

  function getSlotPlaybackRemainingMs(slotIndex: number) {
    if (!isLive) {
      return null;
    }

    if (slotIndex < currentSlotIndex) {
      return 0;
    }

    if (slotIndex > currentSlotIndex) {
      return PLAYBACK_SLOT_DURATION_MS;
    }

    const currentSecondProgressMs = playbackNowMs % 1000;
    return Math.max(
      Math.min(
        slotSecondsRemaining * 1000 - currentSecondProgressMs,
        PLAYBACK_SLOT_DURATION_MS
      ),
      0
    );
  }

  function formatPlaybackTimer(remainingMs: number) {
    const clampedRemainingMs = Math.max(
      Math.min(Math.floor(remainingMs), PLAYBACK_SLOT_DURATION_MS),
      0
    );
    const seconds = Math.floor(clampedRemainingMs / 1000);
    const milliseconds = clampedRemainingMs % 1000;

    return `${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(
      3,
      "0"
    )}`;
  }

  return (
    <div className="mb-6 rounded-3xl border border-white/10 bg-neutral-900 p-5">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FinancialRowItem label="Wallet" value={walletBalanceText} />
          <FinancialRowItem
            label="Escrow: Your auction deposit"
            value={escrowBalanceText}
          />
          <FinancialRowItem
            label="Available for bids"
            value={
              escrowBalanceStatus === "ready"
                ? `${formatUSDCFromMinorUnits(availableAuctionCapacity)} Test USDC`
                : "-"
            }
          />
          <FinancialRowItem
            label="Reserved"
            value={`${formatUSDCFromMinorUnits(reservedAmount)} Test USDC`}
          />
        </div>

        {shouldShowWinners && (
          <div className="auction-landscape-slot-grid grid w-full gap-3 border-t border-white/10 pt-4 md:grid-cols-3">
            {winners.map((winner, index) => {
              const isCurrentWinner = isLive && index === currentSlotIndex;
              const isCurrentBotWinner =
                isCurrentWinner && isDemoBotAdvertisement(winner);
              const playbackRemainingMs = getSlotPlaybackRemainingMs(index);

              return (
                <div
                  key={`winner-${index}`}
                  className={
                    isCurrentBotWinner
                      ? "min-w-0 rounded-2xl border border-emerald-400/60 bg-black/20 p-4"
                      : isCurrentWinner
                        ? "min-w-0 rounded-2xl border border-emerald-400/60 bg-emerald-400/10 p-4 shadow-sm shadow-emerald-950/30"
                        : "min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4"
                  }
                >
                  <div
                    className={
                      isCurrentBotWinner
                        ? "flex items-center justify-between gap-3 text-xs font-semibold text-white/55"
                        : isCurrentWinner
                          ? "flex items-center justify-between gap-3 text-xs font-semibold text-emerald-300"
                          : "flex items-center justify-between gap-3 text-xs font-semibold text-white/50"
                    }
                  >
                    <span>Slot {index + 1}</span>
                    {playbackRemainingMs !== null && (
                      <span
                        className={
                          isCurrentBotWinner
                            ? "rounded-full border border-emerald-300/30 bg-black/30 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums tracking-[0.16em] text-white/55"
                            : isCurrentWinner
                              ? "rounded-full border border-emerald-300/30 bg-black/35 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums tracking-[0.16em] text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.18)]"
                              : "rounded-full border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums tracking-[0.16em] text-white/35"
                        }
                      >
                        {formatPlaybackTimer(playbackRemainingMs)}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-white">
                    {winner.businessName}
                  </p>
                  <p className="mt-1 truncate text-xs text-neutral-300">
                    {winner.name}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FinancialRowItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold tracking-normal text-white/55">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
