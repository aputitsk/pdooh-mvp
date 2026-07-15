import ArcNetworkSwitchButton from "@/components/wallet/ArcNetworkSwitchButton";
import MoneyAmount from "@/components/ui/MoneyAmount";
import styles from "@/components/ui/OperationalPanel.module.css";
import type { UsdcMinorUnits } from "@/lib/money/usdc";

type ConnectWalletCardProps = {
  isWalletConnected: boolean;
  walletStatus: "restoring" | "connected" | "disconnected";
  usdcBalance: string;
  usdcBalanceMinorUnits: UsdcMinorUnits | null;
  usdcBalanceStatus: "idle" | "loading" | "ready" | "error";
  usdcBalanceError: string | null;
  faucetUrl: string;
  onRetryUsdcBalance: () => void;
};

export default function ConnectWalletCard({
  isWalletConnected,
  walletStatus,
  usdcBalance,
  usdcBalanceMinorUnits,
  usdcBalanceStatus,
  usdcBalanceError,
  faucetUrl,
  onRetryUsdcBalance,
}: ConnectWalletCardProps) {
  const isWalletRestoring = walletStatus === "restoring";
  const canShowBalance =
    usdcBalanceStatus === "ready" ||
    (usdcBalanceStatus === "error" && usdcBalanceMinorUnits !== null);
  const balanceText =
    usdcBalanceStatus === "loading"
        ? "Reading balance..."
        : "-";

  return (
    <div className={`${styles.panel} p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={styles.eyebrow}>Step 1</p>
          <h2 className={`${styles.title} mt-1 text-2xl font-bold`}>Wallet</h2>
          <p className={`${styles.mutedText} mt-2 text-sm`}>
            Login is managed from the top navigation bar.
          </p>
        </div>

        <span
          className={`${styles.statusPill} px-3 py-1 text-xs font-semibold ${
            isWalletConnected
              ? styles.statusPillSuccess
              : isWalletRestoring
                ? styles.statusPillInfo
              : ""
          }`}
        >
          {isWalletConnected
            ? "Logged in"
            : isWalletRestoring
              ? "Checking login"
              : "Login required"}
        </span>
      </div>

      <div className={`${styles.metric} mt-5 p-4`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p className={styles.valueLabel}>Arc Testnet USDC Balance</p>

          <p className="text-xs text-white/45 sm:text-right">
            <a
              href={faucetUrl}
              target="_blank"
              rel="noreferrer"
              className={`${styles.textAction} text-xs`}
            >
              Get Test USDC
            </a>
            {" "}
            Testnet USDC has no real value.
          </p>
        </div>

        <p
          className={`${styles.valueText} mt-2 break-words text-lg ${
            canShowBalance ? "font-mono tabular-nums" : ""
          }`}
        >
          {canShowBalance ? (
            <MoneyAmount amount={usdcBalance} unit="Test USDC" />
          ) : (
            balanceText
          )}
        </p>

        {usdcBalanceStatus === "error" && usdcBalanceError ? (
          <div className={`${styles.statusStrip} ${styles.statusStripError} mt-3 px-3 py-2 text-sm`}>
            <p>{usdcBalanceError}</p>
            <button
              type="button"
              onClick={onRetryUsdcBalance}
              className={`${styles.textAction} mt-2 text-sm`}
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>

      <ArcNetworkSwitchButton />
    </div>
  );
}
