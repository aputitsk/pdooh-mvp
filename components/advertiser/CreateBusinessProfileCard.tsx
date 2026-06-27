type CreateBusinessProfileCardProps = {
  businessName: string;
  isBusinessProfileCreated: boolean;
  showBusinessNameError: boolean;
  onBusinessNameChange: (value: string) => void;
  onCreateBusinessProfile: () => void;
};

export default function CreateBusinessProfileCard({
  businessName,
  isBusinessProfileCreated,
  showBusinessNameError,
  onBusinessNameChange,
  onCreateBusinessProfile,
}: CreateBusinessProfileCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white/40">Step 2</p>

          <h2 className="mt-1 text-2xl font-bold">
            Create Business Profile
          </h2>

          <p className="mt-2 text-sm text-white/50">
            One connected wallet can create one business profile.
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isBusinessProfileCreated
              ? "bg-green-500/10 text-green-400"
              : "bg-white/10 text-white/50"
          }`}
        >
          {isBusinessProfileCreated ? "Created" : "Required"}
        </span>
      </div>

      <label className="mt-5 block text-sm text-white/60">
        Business Name
      </label>

      <input
        value={businessName}
        onChange={(e) => onBusinessNameChange(e.target.value)}
        disabled={isBusinessProfileCreated}
        maxLength={20}
        placeholder="Miami Retail Group"
        className={`mt-2 w-full rounded-xl border bg-black/30 px-4 py-3 outline-none transition disabled:cursor-default ${
          isBusinessProfileCreated
            ? "text-green-400 disabled:text-green-400"
            : "text-white disabled:text-white/40"
        } ${
          showBusinessNameError
            ? "border-red-500 focus:border-red-500"
            : "border-white/10 focus:border-white/30"
        }`}
      />

      <p className="mt-2 text-right text-xs text-white/40">
        {businessName.length} / 20
      </p>

      {showBusinessNameError && (
        <p className="mt-2 text-sm text-red-400">
          Business name is required.
        </p>
      )}

      <button
        type="button"
        onClick={onCreateBusinessProfile}
        disabled={isBusinessProfileCreated}
        className={`mt-5 w-full rounded-full px-6 py-3 font-semibold transition ${
          isBusinessProfileCreated
            ? "cursor-default bg-white/10 text-white/40"
            : "cursor-pointer bg-white text-black hover:bg-white/80"
        }`}
      >
        {isBusinessProfileCreated
          ? "Business Profile Created"
          : "Create Business Profile"}
      </button>
    </div>
  );
}