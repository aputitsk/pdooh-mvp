import ArcNetworkSwitchButton from "@/components/wallet/ArcNetworkSwitchButton";

type ConnectWalletCardProps = {
  isWalletConnected: boolean;
  walletStatus: "restoring" | "connected" | "disconnected";
  usdcBalance: string;
  usdcBalanceStatus: "idle" | "loading" | "ready" | "error";
  usdcBalanceError: string | null;
};

export default function ConnectWalletCard({
  isWalletConnected,
  walletStatus,
  usdcBalance,
  usdcBalanceStatus,
  usdcBalanceError,
}: ConnectWalletCardProps) {
  const isWalletRestoring = walletStatus === "restoring";
  const balanceText =
    usdcBalanceStatus === "ready"
      ? `${usdcBalance} Test USDC`
      : usdcBalanceStatus === "loading"
        ? "Reading balance..."
        : usdcBalanceStatus === "error"
          ? usdcBalanceError
          : "Connect wallet in the navbar";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white/40">Step 1</p>
          <h2 className="mt-1 text-2xl font-bold">External Wallet</h2>
          <p className="mt-2 text-sm text-white/50">
            Wallet connection is managed from the top navigation bar.
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isWalletConnected
              ? "bg-green-500/10 text-green-400"
              : isWalletRestoring
                ? "bg-white/10 text-white/60"
              : "bg-white/10 text-white/50"
          }`}
        >
          {isWalletConnected
            ? "Connected"
            : isWalletRestoring
              ? "Checking"
              : "Not Connected"}
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm text-white/50">Arc Testnet USDC Balance</p>

        <p className="mt-1 break-words font-semibold text-white/80">
          {balanceText}
        </p>
      </div>

      <ArcNetworkSwitchButton />
    </div>
  );
}
