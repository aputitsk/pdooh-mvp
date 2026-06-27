type Advertisement = {
  name: string;
  businessName: string;
};

type AdvertisementSelectProps = {
  advertisements: Advertisement[];
  value: string;
  onChange: (value: string) => void;
};

export default function AdvertisementSelect({
  advertisements,
  value,
  onChange,
}: AdvertisementSelectProps) {
  const sortedAdvertisements = [...advertisements].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
    })
  );

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-neutral-300">
        Your Advertisement
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition ${
          value ? "text-white" : "text-neutral-500"
        }`}
      >
        <option value="" disabled>
          Select advertisement
        </option>

        {sortedAdvertisements.map((ad) => (
          <option
            key={`${ad.businessName}-${ad.name}`}
            value={ad.name}
            className="text-white"
          >
            {ad.name}
          </option>
        ))}
      </select>

      {sortedAdvertisements.length === 0 && (
        <p className="mt-2 text-xs text-neutral-500">
          No advertisements available.
        </p>
      )}
    </div>
  );
}
