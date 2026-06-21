import Link from "next/link";

export default function EmptyAdvertisementsCard() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-8 py-16 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-4xl">
        📺
      </div>

      <h2 className="mt-6 text-3xl font-bold text-white">
        No advertisements yet
      </h2>

      <p className="mx-auto mt-4 max-w-md text-white/50">
        Create your first advertisement to participate in private pDOOH
        auctions.
      </p>

      <Link
        href="/advertiser"
        className="mt-8 inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
      >
        Create Advertisement
      </Link>
    </div>
  );
}