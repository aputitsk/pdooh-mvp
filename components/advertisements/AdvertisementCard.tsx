import {
  ADVERTISEMENT_NAME_MAX_LENGTH,
  type Advertisement,
} from "@/lib/advertisements/advertisements";

type AdvertisementCardProps = {
  advertisement: Advertisement;
  editableName?: string;
  errorMessage?: string;
  isEditing?: boolean;
  isDeleteDisabled?: boolean;
  isEditDisabled?: boolean;
  onEditableNameChange?: (value: string) => void;
  onStartEdit?: (name: string) => void;
  onSaveEdit?: (name: string) => void;
  onCancelEdit?: () => void;
  onDelete: (name: string) => void;
};

export default function AdvertisementCard({
  advertisement,
  editableName = advertisement.name,
  errorMessage = "",
  isEditing = false,
  isDeleteDisabled = false,
  isEditDisabled = false,
  onEditableNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: AdvertisementCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-white/20">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-widest text-white/40">
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
                className={`mt-2 w-full rounded-xl border bg-black/30 px-4 py-3 text-white outline-none transition ${
                  errorMessage
                    ? "border-red-500 focus:border-red-500"
                    : "border-white/10 focus:border-white/30"
                }`}
              />

              <p className="mt-2 text-right text-xs text-white/40">
                {editableName.length} / {ADVERTISEMENT_NAME_MAX_LENGTH}
              </p>

              {errorMessage && (
                <p className="mt-2 text-sm text-red-400">
                  {errorMessage}
                </p>
              )}
            </>
          ) : (
            <h2 className="mt-2 break-normal text-2xl font-bold text-[#CFE8FF]">
              {advertisement.name}
            </h2>
          )}

          <p className="mt-2 break-words text-sm text-white/50">
            {advertisement.businessName}
          </p>
        </div>

        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          Ready for Auction
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/40">
          Available for bidding
        </p>

        <div className="flex flex-wrap gap-3">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => onSaveEdit?.(advertisement.name)}
                disabled={isEditDisabled}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/80 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
              >
                Save
              </button>

              <button
                type="button"
                onClick={onCancelEdit}
                disabled={isEditDisabled}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:text-white/30"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onStartEdit?.(advertisement.name)}
              disabled={isEditDisabled}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:text-white/30"
            >
              Edit
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete(advertisement.name)}
            disabled={isDeleteDisabled}
            className="rounded-full border border-red-500/20 px-4 py-2 text-sm font-semibold text-red-300 transition hover:border-red-400 hover:text-red-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
