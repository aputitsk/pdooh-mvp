"use client";

import { useEffect, useState } from "react";
import {
  AUCTION_PLAYBACK_SECONDS_PER_SLOT,
  DEMO_BOT_ADVERTISEMENT,
} from "@/lib/auction/constants";

import styles from "./PremiumBillboard.module.css";
import ArcDemoAdvertisement from "./ArcDemoAdvertisement";
import type { MarketTheme } from "./marketTheme";

const PLAYBACK_SLOT_DURATION_MS = AUCTION_PLAYBACK_SECONDS_PER_SLOT * 1000;

type Advertisement = {
  name: string;
  businessName: string;
};

type LiveScreenProps = {
  winner: Advertisement | null;
  marketTheme: MarketTheme;
  isLive: boolean;
  locationName: string;
  slotNumber: number;
  slotSecondsRemaining: number;
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

function formatPlaybackTimer(remainingMs: number) {
  const clampedRemainingMs = Math.max(
    Math.min(Math.floor(remainingMs), PLAYBACK_SLOT_DURATION_MS),
    0
  );
  const seconds = Math.floor(clampedRemainingMs / 1000);
  const milliseconds = clampedRemainingMs % 1000;

  return `${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(
    3,
    "0"
  )}`;
}

export default function LiveScreen({
  winner,
  marketTheme,
  isLive,
  locationName,
  slotNumber,
  slotSecondsRemaining,
}: LiveScreenProps) {
  const [playbackNowMs, setPlaybackNowMs] = useState(0);
  const isPersonalAdvertisement =
    winner !== null && !isDemoBotAdvertisement(winner);
  const displayStateClassName = isLive
    ? "border-white/25 bg-black shadow-[inset_0_0_70px_rgba(255,255,255,0.11),0_0_44px_rgba(255,255,255,0.08)]"
    : "border-white/[0.04] bg-black shadow-[inset_0_0_52px_rgba(0,0,0,0.88)]";
  const atmosphereStateClassName = isLive
    ? "opacity-100 saturate-150"
    : "opacity-25";
  const haloStateClassName = isLive ? "opacity-100 scale-110" : "opacity-15";
  const reflectionStateClassName = isLive ? "opacity-100" : "opacity-20";
  const contentStateClassName = isLive ? "text-white" : "text-white/40";
  const currentSecondProgressMs = playbackNowMs % 1000;
  const slotPlaybackRemainingMs = Math.max(
    Math.min(
      slotSecondsRemaining * 1000 - currentSecondProgressMs,
      PLAYBACK_SLOT_DURATION_MS
    ),
    0
  );

  useEffect(() => {
    if (!isLive) {
      return;
    }

    const interval = window.setInterval(() => {
      setPlaybackNowMs(Date.now());
    }, 33);

    return () => {
      window.clearInterval(interval);
    };
  }, [isLive]);

  return (
    <div
      className={`${styles.liveScreenCabinet} mb-5 rounded-3xl border p-4 sm:p-5 ${marketTheme.liveScreen.shellClassName}`}
      style={marketTheme.cssVariables}
    >
      <div
        className={`${styles.display} ${styles.liveScreenDisplay} relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border transition-colors duration-300 ${marketTheme.liveScreen.displayClassName} ${displayStateClassName}`}
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
        {isLive && isPersonalAdvertisement && (
          <div
            aria-hidden="true"
            className={`${styles.winnerCelebration} pointer-events-none absolute inset-0`}
          >
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}

        {isLive && (
          <div className="pointer-events-none absolute right-4 top-4 z-40 flex items-center gap-2 rounded-md border border-white/10 bg-black/35 px-2.5 py-1 text-xs font-semibold tracking-normal text-white/55 shadow-[0_0_18px_rgba(255,255,255,0.08)] backdrop-blur-sm">
            <span>Slot {slotNumber}</span>
            <span className="mx-1.5 text-white/25">/</span>
            <span className="font-mono text-[11px] font-semibold tabular-nums tracking-[0.16em] text-cyan-100">
              {formatPlaybackTimer(slotPlaybackRemainingMs)}
            </span>
            <span className="hidden text-white/35 sm:inline">{locationName}</span>
          </div>
        )}

        <div className={`relative z-20 px-6 py-12 text-center ${contentStateClassName}`}>
          {winner ? (
            isPersonalAdvertisement ? (
              <>
                <h2
                  className={`text-balance text-2xl font-semibold tracking-normal text-white/78 drop-shadow-[0_1px_18px_rgba(255,255,255,0.1)] md:text-4xl ${styles.personalWinnerBusiness}`}
                >
                  {winner.businessName}
                </h2>
                <p
                  key={`${winner.businessName}-${winner.name}`}
                  className={`${styles.adName} ${styles.adNameMotion} ${styles.personalWinnerAdName} mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-white md:text-6xl`}
                >
                  {renderAdvertisementText(winner.name)}
                </p>
              </>
            ) : (
              <ArcDemoAdvertisement />
            )
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

        <div className={`${styles.livePixelGrid} absolute inset-0`} />
        <div className={`${styles.scanlines} ${styles.liveScanlines} absolute inset-0`} />
        <div className={`${styles.liveScreenVignette} absolute inset-0`} />
        <div className={`${styles.glassReflection} ${styles.liveGlassReflection} absolute inset-0`} />
      </div>
    </div>
  );
}
