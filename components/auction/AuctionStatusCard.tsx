import type { Advertisement, AuctionPhase } from "@/lib/auction";
import {
  formatUSDCFromMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

type AuctionStatusCardProps = {
  phase: AuctionPhase | "selecting";
  secondsRemaining: number;
  currentSlotIndex: number;
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
  escrowBalance,
  availableAuctionCapacity,
  reservedAmount,
  escrowBalanceStatus,
  escrowBalanceError,
  winners,
}: AuctionStatusCardProps) {
  const getStatus = () => {
    switch (phase) {
      case "open":
        return {
          border: "border-emerald-500/20",
          bg: "bg-emerald-500/10",
          color: "text-emerald-400",
          title: "● AUCTION OPEN",
          main: `${secondsRemaining} sec remaining`,
          description: "Submit hidden bids for Slot 1, Slot 2 and Slot 3.",
        };

      case "selecting":
      case "locked":
        return {
          border: "border-yellow-500/20",
          bg: "bg-yellow-500/10",
          color: "text-yellow-400",
          title: "🏆 AUCTION RESULTS",
          main: "Winners selected",
          description:
            "Winning businesses and advertisements for the current auction cycle.",
        };

      case "live":
        return {
          border: "border-blue-500/20",
          bg: "bg-blue-500/10",
          color: "text-blue-400",
          title: "● LIVE",
          main: `Playing Slot ${currentSlotIndex + 1} of 3`,
          description: `${secondsRemaining} sec remaining`,
        };
    }
  };

  const status = getStatus();
  const escrowBalanceText =
    escrowBalanceStatus === "ready" && escrowBalance !== null
      ? `${formatUSDCFromMinorUnits(escrowBalance)} Test USDC`
      : escrowBalanceStatus === "loading"
        ? "Reading balance..."
        : escrowBalanceStatus === "error"
          ? escrowBalanceError
          : "Connect wallet";

  return (
    <div
      className={`mb-6 rounded-3xl border ${status.border} ${status.bg} p-6`}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${status.color}`}>
            {status.title}
          </p>

          <h2 className="mt-2 text-3xl font-bold">{status.main}</h2>

          <p className="mt-2 text-sm text-neutral-400">
            {status.description}
          </p>

          {(phase === "selecting" || phase === "locked") && (
            <div className="mt-6 grid w-full gap-4 md:grid-cols-3">
              {winners.map((winner, index) => (
                <div
                  key={`winner-${index}`}
                  className="h-full w-full rounded-2xl border border-white/10 bg-black/20 p-5"
                >
                  <p className="text-base font-semibold text-white">
                    Slot {index + 1}
                  </p>

                  <p className="mt-5 text-xs uppercase tracking-widest text-white/50">
                    Winner
                  </p>

                  <p className="mt-1 text-lg font-semibold text-white">
                    {winner.businessName}
                  </p>

                  <p className="mt-5 text-xs uppercase tracking-widest text-white/50">
                    Advertisement
                  </p>

                  <p className="mt-1 text-sm text-neutral-300">
                    {winner.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <>
          <div className="h-px bg-white/10 lg:hidden" />

          <div className="min-w-[240px] rounded-2xl border border-white/10 bg-black/20 px-5 py-4 backdrop-blur">
            <p className="text-xs uppercase tracking-widest text-white/50">
              Escrow Balance
            </p>
            <p className="mt-1 break-words text-xl font-bold">
              {escrowBalanceText}
            </p>

            <p className="mt-4 text-xs uppercase tracking-widest text-white/50">
              Available
            </p>
            <p className="mt-1 text-xl font-bold">
              {escrowBalanceStatus === "ready"
                ? `${formatUSDCFromMinorUnits(availableAuctionCapacity)} Test USDC`
                : "—"}
            </p>

            <p className="mt-4 text-xs uppercase tracking-widest text-white/50">
              Reserved
            </p>
            <p className="mt-1 text-xl font-bold">
              {formatUSDCFromMinorUnits(reservedAmount)} Test USDC
            </p>
          </div>
        </>
      </div>
    </div>
  );
}
