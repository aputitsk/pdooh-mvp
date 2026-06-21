type CreateAdvertisementCardProps = {
  adName: string;
  errorMessage?: string;
  onAdNameChange: (value: string) => void;
  onCreateAdvertisement: () => void;
};

export default function CreateAdvertisementCard({
  adName,
  errorMessage = "",
  onAdNameChange,
  onCreateAdvertisement,
}: CreateAdvertisementCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <div>
        <p className="text-sm text-white/40">Create</p>

        <h2 className="mt-1 text-2xl font-bold">Create Advertisement</h2>

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
        <p className="mt-2 text-sm text-red-400">{errorMessage}</p>
      )}

      <button
        type="button"
        onClick={onCreateAdvertisement}
        className="mt-5 w-full rounded-full bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/80"
      >
        Create Advertisement
      </button>
    </div>
  );
}