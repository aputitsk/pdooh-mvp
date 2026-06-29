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
        Create your first advertisement to participate in pDOOH
        auctions.
      </p>
    </div>
  );
}
