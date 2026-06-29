import styles from "./PremiumBillboard.module.css";

type PremiumBillboardProps = {
  businessName: string;
  advertisementName: string;
};

const tileIndexes = Array.from({ length: 96 }, (_, index) => index);

function renderLightWaveText(value: string) {
  return Array.from(value).map((character, index) => (
    <span
      key={`${character}-${index}`}
      className={styles.letter}
      style={{ animationDelay: `${index * 65}ms` }}
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
    <div
      className={`${styles.billboard} mb-10 rounded-[2rem] border border-cyan-300/10 bg-[#05070B] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.45)]`}
    >
      <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,#121722_0%,#06080D_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div
          className={`${styles.display} relative min-h-[300px] overflow-hidden rounded-[1.15rem] border border-cyan-200/20 bg-black shadow-[0_0_42px_rgba(34,211,238,0.18),inset_0_0_38px_rgba(34,211,238,0.08)]`}
        >
          <div className="absolute inset-0 grid grid-cols-12 gap-px bg-cyan-200/[0.045] p-px">
            {tileIndexes.map((tileIndex) => (
              <div
                key={tileIndex}
                className={`${styles.tile} rounded-[2px] border border-white/[0.035] bg-[linear-gradient(145deg,rgba(8,145,178,0.16),rgba(15,23,42,0.26)_45%,rgba(255,255,255,0.045))]`}
              />
            ))}
          </div>

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(125,211,252,0.2),transparent_40%),linear-gradient(90deg,rgba(8,13,20,0.55),transparent_28%,transparent_72%,rgba(8,13,20,0.6))]" />
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/10 to-transparent" />
          <div
            className={`${styles.scan} absolute inset-y-0 w-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),rgba(125,211,252,0.28),transparent)] blur-[1px]`}
          />

          <div className="relative z-10 flex min-h-[300px] items-center justify-center px-8 py-12 text-center">
            <div className="w-full max-w-3xl min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-cyan-100/55">
                Live Digital Billboard
              </p>

              <h2 className="mt-5 text-balance text-2xl font-semibold tracking-normal text-white/85 drop-shadow-[0_0_18px_rgba(125,211,252,0.22)] md:text-4xl">
                {businessName}
              </h2>

              <p
                className={`${styles.adName} mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-cyan-50/90 md:text-6xl`}
              >
                {renderLightWaveText(advertisementName)}
              </p>
            </div>
          </div>

          <div className="absolute inset-0 rounded-[1.15rem] ring-1 ring-inset ring-white/10" />
        </div>
      </div>
    </div>
  );
}
