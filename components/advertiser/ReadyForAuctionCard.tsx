import Link from "next/link";

type ReadyForAuctionCardProps = {
  businessName: string;
  advertisementCount: number;
  balance: string;
  balanceStatus: "idle" | "loading" | "ready" | "error";
  balanceError: string | null;
};

export default function ReadyForAuctionCard({
  businessName,
  advertisementCount,
  balance,
  balanceStatus,
  balanceError,
}: ReadyForAuctionCardProps) {
  const balanceText =
    balanceStatus === "ready"
      ? `${balance} Test USDC`
      : balanceStatus === "loading"
        ? "Reading balance..."
        : balanceStatus === "error"
          ? balanceError
          : "Connect wallet";

  return (
    <div className="rounded-3xl border border-green-500/30 bg-green-500/10 p-6">
      <p className="text-sm font-semibold text-green-400">
        Ready for Auction
      </p>

      <h2 className="mt-2 text-2xl font-bold">
        {businessName} is ready to participate.
      </h2>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-white/50">
            Advertisements
          </p>

          <p className="mt-2 text-3xl font-bold">
            {advertisementCount}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-white/50">
            Escrow Balance
          </p>

          <p className="mt-2 break-words text-xl font-bold">
            {balanceText}
          </p>
        </div>
      </div>

      <p className="mt-6 text-sm text-white/60">
        Your business profile meets all requirements to participate in the
        pDOOH auction.
      </p>

      <Link
        href="/screen"
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/80"
      >
        Go to Auction
      </Link>
    </div>
  );
}
