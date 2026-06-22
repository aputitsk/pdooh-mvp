type Advertisement = {
  name: string;
  businessName: string;
};

type LiveScreenProps = {
  winner: Advertisement | null;
};

export default function LiveScreen({ winner }: LiveScreenProps) {
  return (
    <div className="mb-10 rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-neutral-700 bg-black">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
            Live Screen
          </p>

          {winner ? (
            <div className="animate-pulse">
              <h2 className="mt-4 text-4xl font-semibold">
                {winner.businessName}
              </h2>

              <p className="mt-3 text-2xl text-neutral-300">
                {winner.name}
              </p>
            </div>
          ) : (
            <>
              <h2 className="mt-4 text-3xl font-semibold">
                Advertisement playback area
              </h2>

              <p className="mt-3 text-neutral-500">
                Winning advertisement will appear here later.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
