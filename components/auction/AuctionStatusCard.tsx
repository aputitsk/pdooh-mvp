import type { Advertisement, AuctionPhase } from "@/lib/auction";
import {
  formatUSDCFromMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

type AuctionStatusCardProps = {
  phase: AuctionPhase | "selecting";
  secondsRemaining: number;
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

export default function AuctionStatusCard({
  phase,
  secondsRemaining,
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

  return (
    <div className="mb-6 rounded-3xl border border-white/10 bg-neutral-900 p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-emerald-400">Live</p>

          {isLive && (
            <p className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/70">
              {secondsRemaining} sec remaining
            </p>
          )}
        </div>

        {shouldShowWinners && (
          <div className="grid w-full gap-3 md:grid-cols-3">
            {winners.map((winner, index) => {
              const isCurrentWinner = isLive && index === currentSlotIndex;

              return (
                <div
                  key={`winner-${index}`}
                  className={
                    isCurrentWinner
                      ? "min-w-0 rounded-2xl border border-emerald-400/60 bg-emerald-400/10 p-4 shadow-sm shadow-emerald-950/30"
                      : "min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4"
                  }
                >
                  <p
                    className={
                      isCurrentWinner
                        ? "text-xs font-semibold text-emerald-300"
                        : "text-xs font-semibold text-white/50"
                    }
                  >
                    Slot {index + 1}
                  </p>
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

        <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <FinancialRowItem label="Wallet" value={walletBalanceText} />
          <FinancialRowItem label="Escrow" value={escrowBalanceText} />
          <FinancialRowItem
            label="Available"
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
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
