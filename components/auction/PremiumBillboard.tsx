import styles from "./PremiumBillboard.module.css";

type PremiumBillboardProps = {
  businessName: string;
  advertisementName: string;
};

const tileIndexes = Array.from({ length: 96 }, (_, index) => index);

function renderAdvertisementText(value: string) {
  return Array.from(value).map((character, index) => (
    <span
      key={`${character}-${index}`}
      className={styles.letter}
    >
      {character === " " ? "\u00A0" : character}
    </span>
  ));
}

export default function PremiumBillboard({
  businessName,
  advertisementName,
}: PremiumBillboardProps) {
  return (
    <div className="mb-10 rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
      <div
        className={`${styles.billboard} ${styles.display} relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-neutral-700 bg-black`}
      >
        <div className="absolute inset-0 grid grid-cols-12 gap-px bg-white/[0.025] p-px">
          {tileIndexes.map((tileIndex) => (
            <div
              key={tileIndex}
              className={`${styles.tile} rounded-[2px] border border-white/[0.025] bg-[linear-gradient(145deg,rgba(255,255,255,0.035),rgba(13,15,18,0.62)_48%,rgba(255,255,255,0.02))]`}
            />
          ))}
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(255,255,255,0.065),transparent_42%),linear-gradient(90deg,rgba(0,0,0,0.5),transparent_30%,transparent_70%,rgba(0,0,0,0.58))]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.095] to-transparent" />
        <div className={`${styles.glassReflection} absolute inset-0`} />
        <div
          className={`${styles.softLight} absolute inset-y-0 w-2/5 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.075),transparent)]`}
        />

        <div className="relative z-10 px-8 py-12 text-center">
          <div className="w-full max-w-3xl min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-white/42">
              Live Digital Billboard
            </p>

            <h2 className="mt-5 text-balance text-2xl font-semibold tracking-normal text-white/78 drop-shadow-[0_1px_18px_rgba(255,255,255,0.1)] md:text-4xl">
              {businessName}
            </h2>

            <p
              key={`${businessName}-${advertisementName}`}
              className={`${styles.adName} ${styles.adNameMotion} mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-white md:text-6xl`}
            >
              {renderAdvertisementText(advertisementName)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
