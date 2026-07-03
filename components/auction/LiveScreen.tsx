import { DEMO_BOT_ADVERTISEMENT } from "@/lib/auction/constants";

import PremiumBillboard from "./PremiumBillboard";

type Advertisement = {
  name: string;
  businessName: string;
};

type LiveScreenProps = {
  winner: Advertisement | null;
  siteLabel: string;
  cycleId: number | string;
};

function isDemoBotAdvertisement(winner: Advertisement) {
  return winner.businessName === DEMO_BOT_ADVERTISEMENT.businessName;
}

export default function LiveScreen({
  winner,
  siteLabel,
  cycleId,
}: LiveScreenProps) {
  if (winner && !isDemoBotAdvertisement(winner)) {
    return (
      <PremiumBillboard
        businessName={winner.businessName}
        advertisementName={winner.name}
        contextLabel={`${siteLabel} · Cycle ${cycleId}`}
      />
    );
  }

  return (
    <div className="mb-10 rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-neutral-700 bg-black">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
            Live Screen
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            {siteLabel} · Cycle {cycleId}
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
