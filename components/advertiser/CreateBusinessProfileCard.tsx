import styles from "@/components/ui/OperationalPanel.module.css";

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
    <div className={`${styles.panel} p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className={styles.eyebrow}>Step 2</p>

          <h2 className={`${styles.title} mt-1 text-2xl font-bold`}>
            Create Business Profile
          </h2>

          {isBusinessProfileCreated ? (
            <>
              {isEditingBusinessName ? (
                <>
                  <input
                    value={visibleBusinessName}
                    onChange={(event) =>
                      onEditableBusinessNameChange?.(event.target.value)
                    }
                    maxLength={20}
                    className={`mt-3 w-full px-4 py-3 ${
                      styles.field
                    } ${showBusinessNameError ? styles.fieldError : ""
                    }`}
                  />

                  <p className="mt-2 text-right text-xs text-white/40">
                    {visibleBusinessName.length} / 20
                  </p>

                  {showBusinessNameError && (
                    <p className={`${styles.statusStrip} ${styles.statusStripError} mt-2 px-3 py-2 text-sm font-medium`}>
                      Business name is required.
                    </p>
                  )}
                </>
              ) : (
                <h3 className="mt-2 break-words text-2xl font-bold text-[#86A6E8]">
                  {businessName}
                </h3>
              )}
            </>
          ) : (
            <p className={`${styles.mutedText} mt-2 text-sm`}>
              One connected wallet can create one business profile.
            </p>
          )}
        </div>

        <span
          className={`${styles.statusPill} px-3 py-1 text-xs font-semibold ${
            isBusinessProfileCreated
              ? styles.statusPillSuccess
              : ""
          }`}
        >
          {isBusinessProfileCreated ? "Created" : "Required"}
        </span>
      </div>

      {!isBusinessProfileCreated && (
        <>
          <label className="mt-5 block text-sm text-white/60">
            Business Name
          </label>

          <input
            value={visibleBusinessName}
            onChange={(event) => onBusinessNameChange(event.target.value)}
            disabled={isInputDisabled}
            maxLength={20}
            placeholder="Miami Retail Group"
            className={`mt-2 w-full px-4 py-3 ${
              styles.field
            } ${showBusinessNameError ? styles.fieldError : ""
            }`}
          />

          <p className="mt-2 text-right text-xs text-white/40">
            {visibleBusinessName.length} / 20
          </p>

          {showBusinessNameError && (
            <p className={`${styles.statusStrip} ${styles.statusStripError} mt-2 px-3 py-2 text-sm font-medium`}>
              Business name is required.
            </p>
          )}
        </>
      )}

      {isBusinessProfileCreated ? (
        <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className={styles.valueLabel}>
            Business profile
          </p>

          <div className="flex flex-wrap gap-3">
            {isEditingBusinessName ? (
              <>
                <button
                  type="button"
                  onClick={onSaveBusinessNameEdit}
                  disabled={isEditDisabled}
                  className={`${styles.primaryAction} px-4 py-2 text-sm font-semibold`}
                >
                  Save
                </button>

                <button
                  type="button"
                  onClick={onCancelBusinessNameEdit}
                  disabled={isEditDisabled}
                  className={`${styles.secondaryAction} px-4 py-2 text-sm font-semibold`}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onStartBusinessNameEdit}
                disabled={isEditDisabled}
                className={`${styles.secondaryAction} px-4 py-2 text-sm font-semibold`}
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
          className={`${styles.primaryAction} mt-5 min-h-12 w-full px-6 py-3 font-semibold`}
        >
          Create Business Profile
        </button>
      )}
    </div>
  );
}
