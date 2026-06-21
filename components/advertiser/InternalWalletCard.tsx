type InternalWalletCardProps = {
  balance: string;
  depositAmount: string;
  onDepositAmountChange: (value: string) => void;
  onDeposit: () => void;
};

export default function InternalWalletCard({
  balance,
  depositAmount,
  onDepositAmountChange,
  onDeposit,
}: InternalWalletCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <div>
        <p className="text-sm text-white/40">Step 3</p>

        <h2 className="mt-1 text-2xl font-bold">
          Internal Wallet
        </h2>

        <p className="mt-2 text-sm text-white/50">
          Your company receives one internal wallet on the pDOOH platform.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
        <p className="text-sm text-white/50">
          Balance
        </p>

        <p className="mt-2 text-4xl font-bold">
          {balance} Test USDC
        </p>
      </div>

      <label className="mt-6 block text-sm text-white/60">
        Deposit Test USDC
      </label>

      <input
        type="number"
        min="0"
        value={depositAmount}
        onChange={(e) => onDepositAmountChange(e.target.value)}
        placeholder="10"
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
      />

      <button
        type="button"
        onClick={onDeposit}
        className="mt-5 w-full rounded-full bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-400"
      >
        Deposit Test USDC
      </button>
    </div>
  );
}