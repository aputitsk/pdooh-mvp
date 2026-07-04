type HiddenBidInputProps = {
  value: string;
  onChange: (value: string) => void;
  controlWrapperClassName?: string;
};

export default function HiddenBidInput({
  value,
  onChange,
  controlWrapperClassName = "",
}: HiddenBidInputProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-neutral-300">
        Your Bid
      </label>

      <div
        className={`flex rounded-xl border border-neutral-700 bg-neutral-950 transition ${controlWrapperClassName}`}
      >
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="w-full bg-transparent px-4 py-3 text-sm outline-none placeholder:text-neutral-600"
        />

        <div className="border-l border-neutral-700 px-4 py-3 text-sm text-neutral-400">
          Test USDC
        </div>
      </div>
    </div>
  );
}
