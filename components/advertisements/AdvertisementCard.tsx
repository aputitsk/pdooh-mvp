import {
  ADVERTISEMENT_NAME_MAX_LENGTH,
  type Advertisement,
} from "@/lib/advertisements/advertisements";
import styles from "@/components/ui/OperationalPanel.module.css";

type AdvertisementCardProps = {
  advertisement: Advertisement;
  editableName?: string;
  errorMessage?: string;
  isEditing?: boolean;
  isDeleteConfirming?: boolean;
  isDeleteDisabled?: boolean;
  isEditDisabled?: boolean;
  onEditableNameChange?: (value: string) => void;
  onStartEdit?: (name: string) => void;
  onSaveEdit?: (name: string) => void;
  onCancelEdit?: () => void;
  onRequestDelete: (name: string) => void;
  onConfirmDelete: (name: string) => void;
  onCancelDelete: () => void;
};

export default function AdvertisementCard({
  advertisement,
  editableName = advertisement.name,
  errorMessage = "",
  isEditing = false,
  isDeleteConfirming = false,
  isDeleteDisabled = false,
  isEditDisabled = false,
  onEditableNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: AdvertisementCardProps) {
  return (
    <div className={`${styles.panel} p-6 transition hover:border-[#7dbee1]/35`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className={styles.eyebrow}>
            Advertisement
          </p>

          {isEditing ? (
            <>
              <input
                value={editableName}
                onChange={(event) =>
                  onEditableNameChange?.(event.target.value)
                }
                maxLength={ADVERTISEMENT_NAME_MAX_LENGTH}
                className={`mt-2 w-full px-4 py-3 ${
                  styles.field
                } ${errorMessage ? styles.fieldError : ""
                }`}
              />

              <p className="mt-2 text-right text-xs text-white/40">
                {editableName.length} / {ADVERTISEMENT_NAME_MAX_LENGTH}
              </p>

              {errorMessage && (
                <p className={`${styles.statusStrip} ${styles.statusStripError} mt-2 px-3 py-2 text-sm font-medium`}>
                  {errorMessage}
                </p>
              )}
            </>
          ) : (
            <h2 className={`${styles.title} mt-2 break-normal text-2xl font-bold`}>
              {advertisement.name}
            </h2>
          )}

          <p className={`${styles.mutedText} mt-2 break-words text-sm`}>
            {advertisement.businessName}
          </p>
        </div>

        <span className={`${styles.statusPill} ${styles.statusPillSuccess} px-3 py-1 text-xs font-semibold`}>
          Ready for Auction
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          {isDeleteConfirming ? (
            <>
              <button
                type="button"
                onClick={() => onConfirmDelete(advertisement.name)}
                disabled={isDeleteDisabled}
                className={`${styles.dangerAction} px-4 py-2 text-sm font-semibold`}
              >
                Confirm
              </button>

              <button
                type="button"
                onClick={onCancelDelete}
                disabled={isDeleteDisabled}
                className={`${styles.secondaryAction} px-4 py-2 text-sm font-semibold`}
              >
                Cancel
              </button>
            </>
          ) : isEditing ? (
            <>
              <button
                type="button"
                onClick={() => onSaveEdit?.(advertisement.name)}
                disabled={isEditDisabled}
                className={`${styles.primaryAction} px-4 py-2 text-sm font-semibold`}
              >
                Save
              </button>

              <button
                type="button"
                onClick={onCancelEdit}
                disabled={isEditDisabled}
                className={`${styles.secondaryAction} px-4 py-2 text-sm font-semibold`}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => onRequestDelete(advertisement.name)}
                disabled={isDeleteDisabled}
                className={`${styles.dangerAction} px-4 py-2 text-sm font-semibold`}
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onStartEdit?.(advertisement.name)}
                disabled={isEditDisabled}
                className={`${styles.secondaryAction} px-4 py-2 text-sm font-semibold`}
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() => onRequestDelete(advertisement.name)}
                disabled={isDeleteDisabled}
                className={`${styles.dangerAction} px-4 py-2 text-sm font-semibold`}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
