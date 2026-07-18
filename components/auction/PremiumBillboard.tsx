import styles from "./PremiumBillboard.module.css";
import ArcDemoAdvertisement from "./ArcDemoAdvertisement";
import type { MarketTheme } from "./marketTheme";
import { DEMO_BOT_ADVERTISEMENT } from "@/lib/auction/constants";

type PremiumBillboardProps = {
  businessName: string;
  advertisementName: string;
  marketTheme: MarketTheme;
};

type LetterStyle = React.CSSProperties & {
  "--letter-index": number;
};

const tileIndexes = Array.from({ length: 96 }, (_, index) => index);

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

function isDemoBotAdvertisement(businessName: string, advertisementName: string) {
  return (
    businessName === DEMO_BOT_ADVERTISEMENT.businessName &&
    advertisementName === DEMO_BOT_ADVERTISEMENT.name
  );
}

export default function PremiumBillboard({
  businessName,
  advertisementName,
  marketTheme,
}: PremiumBillboardProps) {
  const isDemoBot = isDemoBotAdvertisement(businessName, advertisementName);

  return (
    <div
      className={`mb-5 rounded-3xl border p-6 ${marketTheme.billboard.shellClassName}`}
      style={marketTheme.cssVariables}
    >
      <div
        className={`${styles.billboard} ${styles.display} relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-black ${marketTheme.billboard.displayClassName}`}
      >
        <div className="absolute inset-0 grid grid-cols-12 gap-px bg-white/[0.025] p-px">
          {tileIndexes.map((tileIndex) => (
            <div
              key={tileIndex}
              className={`${styles.tile} rounded-[2px] border border-white/[0.025] bg-[linear-gradient(145deg,rgba(255,255,255,0.035),rgba(13,15,18,0.62)_48%,rgba(255,255,255,0.02))]`}
            />
          ))}
        </div>

        <div className={`absolute inset-0 ${marketTheme.billboard.atmosphereClassName}`} />
        <div
          className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${marketTheme.billboard.topGlowClassName}`}
        />
        <div className={`${styles.scanlines} absolute inset-0`} />
        <div className={`${styles.ambientGlow} absolute inset-0`} />
        <div className={`${styles.glassReflection} absolute inset-0`} />
        <div
          className={`${styles.softLight} absolute inset-y-0 w-2/5 ${marketTheme.billboard.softLightClassName}`}
        />

        <div className="relative z-10 w-full px-8 py-12 text-center">
          {isDemoBot ? (
            <ArcDemoAdvertisement />
          ) : (
            <div className="mx-auto w-full max-w-3xl min-w-0">
              <h2 className="text-balance text-2xl font-semibold tracking-normal text-white/78 drop-shadow-[0_1px_18px_rgba(255,255,255,0.1)] md:text-4xl">
                {businessName}
              </h2>

              <p
                key={`${businessName}-${advertisementName}`}
                className={`${styles.adName} ${styles.adNameMotion} mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-white md:text-6xl`}
              >
                {renderAdvertisementText(advertisementName)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
