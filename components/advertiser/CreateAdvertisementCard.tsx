type Advertisement = {
  name: string;
  businessName: string;
};

type CreateAdvertisementCardProps = {
  adName: string;
  ads: Advertisement[];
  errorMessage?: string;
  onAdNameChange: (value: string) => void;
  onCreateAdvertisement: () => void;
};

export default function CreateAdvertisementCard({
  adName,
  ads,
  errorMessage = "",
  onAdNameChange,
  onCreateAdvertisement,
}: CreateAdvertisementCardProps) {
  const sortedAds = [...ads].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
    })
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <div>
        <p className="text-sm text-white/40">Step 4</p>

        <h2 className="mt-1 text-2xl font-bold">
          Create Advertisement
        </h2>

        <p className="mt-2 text-sm text-white/50">
          Create a simple text advertisement for the MVP.
        </p>
      </div>

      <label className="mt-5 block text-sm text-white/60">
        Advertisement Name
      </label>

      <input
        value={adName}
        onChange={(e) => onAdNameChange(e.target.value)}
        placeholder="Summer Sale"
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
      />

      {errorMessage && (
        <p className="mt-2 text-sm text-red-400">
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={onCreateAdvertisement}
        className="mt-5 w-full rounded-full bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/80"
      >
        Create Advertisement
      </button>

      <div className="mt-6 border-t border-white/10 pt-5">
        <h3 className="text-sm font-semibold text-white/70">
          My Advertisements
        </h3>

        {sortedAds.length === 0 ? (
          <p className="mt-3 text-sm text-white/40">
            No advertisements yet.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {sortedAds.map((ad) => (
              <div
                key={`${ad.businessName}-${ad.name}`}
                className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4"
              >
                <p className="text-sm text-white/50">
                  Advertisement
                </p>

                <p className="mt-1 text-xl font-bold">
                  {ad.name}
                </p>

                <p className="mt-2 text-sm text-white/60">
                  Business: {ad.businessName}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
