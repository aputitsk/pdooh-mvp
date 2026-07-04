import { DEMO_BOT_ADVERTISEMENT } from "@/lib/auction/constants";

import styles from "./PremiumBillboard.module.css";
import type { MarketTheme } from "./marketTheme";

type Advertisement = {
  name: string;
  businessName: string;
};

type LiveScreenProps = {
  winner: Advertisement | null;
  marketTheme: MarketTheme;
  isLive: boolean;
};

type LetterStyle = React.CSSProperties & {
  "--letter-index": number;
};

function isDemoBotAdvertisement(winner: Advertisement) {
  return winner.businessName === DEMO_BOT_ADVERTISEMENT.businessName;
}

function renderAdvertisementText(value: string) {
  return Array.from(value).map((character, index) => (
    <span
      key={`${character}-${index}`}
      className={styles.letter}
      style={{ "--letter-index": index } as LetterStyle}
    >
      {character === " " ? "\u00A0" : character}
    </span>
  ));
}

export default function LiveScreen({
  winner,
  marketTheme,
  isLive,
}: LiveScreenProps) {
  const isPersonalAdvertisement =
    winner !== null && !isDemoBotAdvertisement(winner);
  const displayStateClassName = isLive
    ? "border-white/25 bg-black shadow-[inset_0_0_70px_rgba(255,255,255,0.11),0_0_44px_rgba(255,255,255,0.08)]"
    : "border-white/[0.04] bg-black shadow-[inset_0_0_52px_rgba(0,0,0,0.88)]";
  const atmosphereStateClassName = isLive ? "opacity-100 saturate-150" : "opacity-25";
  const haloStateClassName = isLive ? "opacity-100 scale-110" : "opacity-15";
  const reflectionStateClassName = isLive ? "opacity-100" : "opacity-20";
  const contentStateClassName = isLive ? "text-white" : "text-white/40";

  return (
    <div
      className={`mb-5 rounded-3xl border p-6 ${marketTheme.liveScreen.shellClassName}`}
      style={marketTheme.cssVariables}
    >
      <div
        className={`relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-dashed transition-colors duration-300 ${marketTheme.liveScreen.displayClassName} ${displayStateClassName}`}
      >
        <div
          className={`pointer-events-none absolute inset-0 ${marketTheme.liveScreen.atmosphereClassName} ${atmosphereStateClassName}`}
        />
        <div
          className={`pointer-events-none absolute inset-x-10 top-8 h-44 ${marketTheme.liveScreen.haloClassName} ${haloStateClassName}`}
        />
        <div
          className={`pointer-events-none absolute inset-x-8 bottom-0 h-20 ${marketTheme.liveScreen.reflectionClassName} ${reflectionStateClassName}`}
        />

        <div className={`relative z-10 text-center ${contentStateClassName}`}>
          {winner ? (
            <>
              <h2 className="text-balance text-2xl font-semibold tracking-normal text-white/78 drop-shadow-[0_1px_18px_rgba(255,255,255,0.1)] md:text-4xl">
                {winner.businessName}
              </h2>

              {isPersonalAdvertisement ? (
                <p
                  key={`${winner.businessName}-${winner.name}`}
                  className={`${styles.adName} ${styles.adNameMotion} mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-white md:text-6xl`}
                >
                  {renderAdvertisementText(winner.name)}
                </p>
              ) : (
                <p className="mt-3 text-2xl text-white/80">{winner.name}</p>
              )}
            </>
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
