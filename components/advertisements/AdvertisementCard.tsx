import type { Advertisement } from "@/lib/advertisements/advertisements";

type AdvertisementCardProps = {
  advertisement: Advertisement;
  isDeleteDisabled?: boolean;
  onDelete: (name: string) => void;
};

export default function AdvertisementCard({
  advertisement,
  isDeleteDisabled = false,
  onDelete,
}: AdvertisementCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-white/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40">
            Advertisement
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            {advertisement.name}
          </h2>

          <p className="mt-2 text-sm text-white/50">
            {advertisement.businessName}
          </p>
        </div>

        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          Ready for Auction
        </span>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
        <p className="text-sm text-white/40">
          Available for hidden bidding
        </p>

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
  );
}
