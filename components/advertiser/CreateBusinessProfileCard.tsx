type CreateBusinessProfileCardProps = {
  businessName: string;
  editableBusinessName?: string;
  isBusinessProfileCreated: boolean;
  isEditingBusinessName?: boolean;
  showBusinessNameError: boolean;
  isEditDisabled?: boolean;
  onBusinessNameChange: (value: string) => void;
  onEditableBusinessNameChange?: (value: string) => void;
  onCreateBusinessProfile: () => void;
  onStartBusinessNameEdit?: () => void;
  onSaveBusinessNameEdit?: () => void;
  onCancelBusinessNameEdit?: () => void;
};

export default function CreateBusinessProfileCard({
  businessName,
  editableBusinessName = businessName,
  isBusinessProfileCreated,
  isEditingBusinessName = false,
  showBusinessNameError,
  isEditDisabled = false,
  onBusinessNameChange,
  onEditableBusinessNameChange,
  onCreateBusinessProfile,
  onStartBusinessNameEdit,
  onSaveBusinessNameEdit,
  onCancelBusinessNameEdit,
}: CreateBusinessProfileCardProps) {
  const visibleBusinessName = isEditingBusinessName
    ? editableBusinessName
    : businessName;
  const isInputDisabled =
    isBusinessProfileCreated && !isEditingBusinessName;

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
        value={visibleBusinessName}
        onChange={(e) =>
          isEditingBusinessName
            ? onEditableBusinessNameChange?.(e.target.value)
            : onBusinessNameChange(e.target.value)
        }
        disabled={isInputDisabled}
        maxLength={20}
        placeholder="Miami Retail Group"
        className={`mt-2 w-full rounded-xl border bg-black/30 px-4 py-3 outline-none transition disabled:cursor-default ${
          isBusinessProfileCreated && !isEditingBusinessName
            ? "text-[#5A8DFF] disabled:text-[#5A8DFF]"
            : "text-white disabled:text-white/40"
        } ${
          showBusinessNameError
            ? "border-red-500 focus:border-red-500"
            : "border-white/10 focus:border-white/30"
        }`}
      />

      <p className="mt-2 text-right text-xs text-white/40">
        {visibleBusinessName.length} / 20
      </p>

      {showBusinessNameError && (
        <p className="mt-2 text-sm text-red-400">
          Business name is required.
        </p>
      )}

      {isBusinessProfileCreated ? (
        <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-5">
          <p className="text-sm text-white/40">
            Business profile
          </p>

          <div className="flex w-full flex-col gap-3 sm:flex-row">
            {isEditingBusinessName ? (
              <>
                <button
                  type="button"
                  onClick={onSaveBusinessNameEdit}
                  disabled={isEditDisabled}
                  className="min-h-12 w-full rounded-full bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/80 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
                >
                  Save
                </button>

                <button
                  type="button"
                  onClick={onCancelBusinessNameEdit}
                  disabled={isEditDisabled}
                  className="min-h-12 w-full rounded-full border border-white/10 px-6 py-3 font-semibold text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:text-white/30"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onStartBusinessNameEdit}
                disabled={isEditDisabled}
                className="min-h-12 w-full rounded-full border border-white/10 px-6 py-3 font-semibold text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:text-white/30"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onCreateBusinessProfile}
          disabled={isBusinessProfileCreated}
          className="mt-5 min-h-12 w-full rounded-full bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/80"
        >
          Create Business Profile
        </button>
      )}
    </div>
  );
}
