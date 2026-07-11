"use client";

import {
  getAuctionClock,
  MARKET_CONFIGS,
  SITE_CONFIGS,
  type SiteConfig,
  type SiteKey,
} from "@/lib/auction";
import { AUCTION_TOTAL_CYCLE_SECONDS } from "@/lib/auction/constants";

import { getMarketTheme } from "./marketTheme";

type SiteSelectorCardsProps = {
  selectedSiteKey: SiteKey;
  onSiteChange: (siteKey: SiteKey) => void;
  isDisabled: boolean;
};

function getMarketName(siteConfig: SiteConfig) {
  return (
    MARKET_CONFIGS.find((market) => market.id === siteConfig.marketId)?.name ??
    siteConfig.marketId
  );
}

function getAuctionDisplayStatus(siteConfig: SiteConfig) {
  const clock = getAuctionClock(siteConfig.auctionStartTimestampMs);
  const displaySecondsRemaining =
    clock.phase === "live"
      ? Math.max(AUCTION_TOTAL_CYCLE_SECONDS - clock.elapsedInCycle, 0)
      : clock.secondsRemaining;
  const statusText =
    clock.phase === "live"
      ? `LIVE • Next auction in ${displaySecondsRemaining} sec`
      : "Live";
  const detailText = clock.phase === "open" ? "Slot bidding is open" : null;

  return { statusText, detailText };
}

export default function SiteSelectorCards({
  selectedSiteKey,
  onSiteChange,
  isDisabled,
}: SiteSelectorCardsProps) {
  return (
    <section className="mb-5">
      <div className="mb-3 flex items-end justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
            Market / Site
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-normal text-[#CFE8FF]">
            Select operating venue
          </h2>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 landscape:[@media(max-height:560px)]:grid-cols-2">
        {SITE_CONFIGS.map((siteConfig) => {
          const isSelected = selectedSiteKey === siteConfig.siteKey;
          const theme = getMarketTheme(siteConfig.siteKey);
          const { statusText, detailText } = getAuctionDisplayStatus(siteConfig);

          return (
            <button
              key={siteConfig.siteKey}
              type="button"
              aria-pressed={isSelected}
              disabled={isDisabled}
              onClick={() => {
                if (!isSelected) {
                  onSiteChange(siteConfig.siteKey);
                }
              }}
              className={`group relative min-h-32 overflow-hidden rounded-2xl border p-5 text-left transition duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${theme.siteCard.focusClassName} ${
                isSelected
                  ? theme.siteCard.activeClassName
                  : theme.siteCard.inactiveClassName
              }`}
            >
              <div
                className={`absolute left-0 top-0 h-px w-full bg-gradient-to-r ${theme.siteCard.trackClassName}`}
              />
              <div
                className={`absolute right-5 top-5 h-2.5 w-2.5 rounded-full ${
                  isSelected
                    ? theme.siteCard.selectedIndicatorClassName
                  : "bg-white/15"
                }`}
              />

              <div className="relative flex h-full flex-col justify-between gap-5">
                <div>
                  <div className="flex items-center justify-between gap-4 pr-6">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                      Market
                    </p>
                    {isSelected && (
                      <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
                        Selected
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 flex min-w-0 items-baseline gap-2 overflow-hidden whitespace-nowrap text-xl font-semibold tracking-normal text-[#CFE8FF]">
                    <span className="shrink-0">{getMarketName(siteConfig)}</span>
                    <span className="shrink-0 text-white/35">/</span>
                    <span className="truncate text-base font-semibold text-white/70">
                      {siteConfig.name}
                    </span>
                  </h3>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${
                        isSelected
                          ? theme.siteCard.statusActiveClassName
                          : "border-white/10 bg-white/[0.03] text-white/50"
                      }`}
                    >
                      {statusText}
                    </span>
                    {detailText && (
                      <span className="inline-flex rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-semibold text-white/45">
                        {detailText}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
