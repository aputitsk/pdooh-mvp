import ArcNetworkSwitchButton from "@/components/wallet/ArcNetworkSwitchButton";
import MoneyAmount from "@/components/ui/MoneyAmount";
import styles from "@/components/ui/OperationalPanel.module.css";

type ConnectWalletCardProps = {
  isWalletConnected: boolean;
  walletStatus: "restoring" | "connected" | "disconnected";
  usdcBalance: string;
  usdcBalanceStatus: "idle" | "loading" | "ready" | "error";
  usdcBalanceError: string | null;
  faucetUrl: string;
};

export default function ConnectWalletCard({
  isWalletConnected,
  walletStatus,
  usdcBalance,
  usdcBalanceStatus,
  usdcBalanceError,
  faucetUrl,
}: ConnectWalletCardProps) {
  const isWalletRestoring = walletStatus === "restoring";
  const balanceText =
    usdcBalanceStatus === "loading"
        ? "Reading balance..."
        : usdcBalanceStatus === "error"
          ? usdcBalanceError
          : "Connect wallet in the navbar";

  return (
    <div className={`${styles.panel} p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={styles.eyebrow}>Step 1</p>
          <h2 className={`${styles.title} mt-1 text-2xl font-bold`}>External Wallet</h2>
          <p className={`${styles.mutedText} mt-2 text-sm`}>
            Wallet connection is managed from the top navigation bar.
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
            ? "Connected"
            : isWalletRestoring
              ? "Checking"
              : "Not Connected"}
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
            usdcBalanceStatus === "ready" ? "font-mono tabular-nums" : ""
          }`}
        >
          {usdcBalanceStatus === "ready" ? (
            <MoneyAmount amount={usdcBalance} unit="Test USDC" />
          ) : (
            balanceText
          )}
        </p>
      </div>

      <ArcNetworkSwitchButton />
    </div>
  );
}
