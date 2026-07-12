import { ADVERTISEMENT_NAME_MAX_LENGTH } from "@/lib/advertisements/advertisements";
import styles from "@/components/ui/OperationalPanel.module.css";

type CreateAdvertisementCardProps = {
  adName: string;
  errorMessage?: string;
  isDisabled?: boolean;
  isCreateSuccessVisible?: boolean;
  onAdNameChange: (value: string) => void;
  onCreateAdvertisement: () => void;
};

export default function CreateAdvertisementCard({
  adName,
  errorMessage = "",
  isDisabled = false,
  isCreateSuccessVisible = false,
  onAdNameChange,
  onCreateAdvertisement,
}: CreateAdvertisementCardProps) {
  return (
    <div className={`${styles.panel} p-6`}>
      <div>
        <p className={styles.eyebrow}>Create</p>

        <h2 className={`${styles.title} mt-1 text-2xl font-bold`}>
          Create New Advertisement
        </h2>

        <p className={`${styles.mutedText} mt-2 text-sm`}>
          Create a simple text advertisement for the MVP.
        </p>
      </div>

      <label className="mt-5 block text-sm text-white/60">
        Advertisement Name
      </label>

      <input
        value={adName}
        onChange={(e) => onAdNameChange(e.target.value)}
        disabled={isDisabled}
        maxLength={ADVERTISEMENT_NAME_MAX_LENGTH}
        placeholder="Summer Sale"
        className={`${styles.field} mt-2 w-full px-4 py-3 disabled:cursor-not-allowed`}
      />

      <p className="mt-2 text-right text-xs text-white/40">
        {adName.length} / {ADVERTISEMENT_NAME_MAX_LENGTH}
      </p>

      {errorMessage && (
        <p className={`${styles.statusStrip} ${styles.statusStripError} mt-2 px-3 py-2 text-sm font-medium`}>
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={onCreateAdvertisement}
        disabled={isDisabled || isCreateSuccessVisible}
        className={`mt-5 w-full px-6 py-3 font-semibold disabled:cursor-not-allowed ${
          isCreateSuccessVisible
            ? styles.successAction
            : styles.primaryAction
        }`}
      >
        {isCreateSuccessVisible ? "✓ Created" : "Create Advertisement"}
      </button>
    </div>
  );
}
