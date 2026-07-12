import Link from "next/link";
import styles from "@/components/ui/OperationalPanel.module.css";

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
    balanceStatus === "loading"
        ? "Reading balance..."
        : balanceStatus === "error"
          ? balanceError
          : "Connect wallet";

  return (
    <div className={`${styles.panel} ${styles.panelReady} p-6`}>
      <p className={`${styles.statusPill} ${styles.statusPillSuccess} inline-flex px-3 py-1 text-xs font-semibold`}>
        Ready for Auction
      </p>

      <h2 className={`${styles.title} mt-2 text-2xl font-bold`}>
        {businessName} is ready to participate.
      </h2>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className={`${styles.metric} flex items-center justify-between gap-4 p-4`}>
          <p className={`${styles.valueLabel} shrink-0`}>
            Advertisements
          </p>

          <p className={`${styles.valueText} shrink-0 text-xl`}>
            {advertisementCount}
          </p>
        </div>

        <div className={`${styles.metric} flex items-center justify-between gap-4 p-4`}>
          <p className={`${styles.valueLabel} shrink-0`}>
            Escrow Balance
          </p>

          <p
            className={`${styles.valueText} min-w-0 truncate text-right text-xl ${
              balanceStatus === "ready" ? "font-mono tabular-nums" : ""
            }`}
          >
            {balanceStatus === "ready" ? (
              <span className="inline-flex min-w-0 items-baseline justify-end gap-1 whitespace-nowrap">
                <span>{balance}</span>
                <span className="text-[0.55rem] font-semibold text-white/45">
                  Test USDC
                </span>
              </span>
            ) : (
              balanceText
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/advertisements"
          className={`${styles.secondaryAction} inline-flex min-h-12 w-full items-center justify-center px-6 py-3 font-semibold`}
        >
          Open Advertisements
        </Link>

        <Link
          href="/screen"
          className={`${styles.primaryAction} inline-flex min-h-12 w-full items-center justify-center px-6 py-3 font-semibold`}
        >
          Go to Auction
        </Link>
      </div>
    </div>
  );
}
