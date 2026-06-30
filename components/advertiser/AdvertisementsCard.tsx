import Link from "next/link";

type AdvertisementsCardProps = {
  advertisementCount: number;
};

export default function AdvertisementsCard({
  advertisementCount,
}: AdvertisementsCardProps) {
  const advertisementLabel =
    advertisementCount === 1 ? "Advertisement" : "Advertisements";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <div>
        <p className="text-sm text-white/40">Step 4</p>

        <h2 className="mt-1 text-2xl font-bold">Advertisements</h2>

        <p className="mt-2 text-sm text-white/50">
          Create, manage, and delete advertisements in the dedicated
          advertisements workspace.
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm text-white/50">Created Advertisements</p>

        <p className="mt-1 text-2xl font-bold text-white">
          {advertisementCount}
          <span className="ml-2 text-sm font-medium text-white/50">
            {advertisementLabel}
          </span>
        </p>
      </div>

      <Link
        href="/advertisements"
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/80"
      >
        Open Advertisements
      </Link>
    </div>
  );
}
