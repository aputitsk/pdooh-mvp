import { formatWalletAddress } from "@/lib/wallet";

const iconBadgeClassName =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#4F8CFF]/35 bg-[radial-gradient(circle_at_35%_25%,#183B6A_0%,#10284D_74%)] text-[#E7F0FF] shadow-[0_0_10px_#4F8CFF24]";

type ConnectWalletCardProps = {
  isWalletConnected: boolean;
  walletAddress: string | null;
  walletStatus: "restoring" | "connected" | "disconnected";
  usdcBalance: string;
  usdcBalanceStatus: "idle" | "loading" | "ready" | "error";
  usdcBalanceError: string | null;
};

export default function ConnectWalletCard({
  isWalletConnected,
  walletAddress,
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
        <div className="flex items-start gap-3">
          <span className={iconBadgeClassName} aria-hidden="true">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4.5 8.5H18.5C19.6046 8.5 20.5 9.39543 20.5 10.5V17.5C20.5 18.6046 19.6046 19.5 18.5 19.5H5.5C4.39543 19.5 3.5 18.6046 3.5 17.5V7.5C3.5 6.39543 4.39543 5.5 5.5 5.5H17"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16.5 14H16.51"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </span>

          <div>
            <p className="text-sm text-white/40">Step 1</p>
            <h2 className="mt-1 text-2xl font-bold">External Wallet</h2>
            <p className="mt-2 text-sm text-white/50">
              Wallet connection is managed from the top navigation bar.
            </p>
          </div>
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
        <p className="text-sm text-white/50">Wallet Address</p>

        <p className="mt-1 font-semibold text-white/80">
          {isWalletConnected && walletAddress
            ? formatWalletAddress(walletAddress)
            : isWalletRestoring
              ? "Checking wallet..."
            : "Connect wallet in the navbar"}
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm text-white/50">Arc Testnet USDC Balance</p>

        <p className="mt-1 break-words font-semibold text-white/80">
          {balanceText}
        </p>
      </div>
    </div>
  );
}
