type CreateCompanyCardProps = {
  companyName: string;
  isCompanyCreated: boolean;
  onCompanyNameChange: (value: string) => void;
  onCreateCompany: () => void;
};

export default function CreateCompanyCard({
  companyName,
  isCompanyCreated,
  onCompanyNameChange,
  onCreateCompany,
}: CreateCompanyCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white/40">Step 2</p>
          <h2 className="mt-1 text-2xl font-bold">Create Company</h2>

          <p className="mt-2 text-sm text-white/50">
            One connected wallet can create one company.
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isCompanyCreated
              ? "bg-green-500/10 text-green-400"
              : "bg-white/10 text-white/50"
          }`}
        >
          {isCompanyCreated ? "Created" : "Required"}
        </span>
      </div>

      <label className="mt-5 block text-sm text-white/60">
        Company Name
      </label>

      <input
        value={companyName}
        onChange={(e) => onCompanyNameChange(e.target.value)}
        disabled={isCompanyCreated}
        placeholder="Miami Retail Group"
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none disabled:cursor-default disabled:text-white/40"
      />

      <button
        type="button"
        onClick={onCreateCompany}
        disabled={isCompanyCreated}
        className={`mt-5 w-full rounded-full px-6 py-3 font-semibold transition ${
          isCompanyCreated
            ? "cursor-default bg-white/10 text-white/40"
            : "cursor-pointer bg-white text-black hover:bg-white/80"
        }`}
      >
        {isCompanyCreated ? "Company Created" : "Create Company"}
      </button>
    </div>
  );
}