import type { CSSProperties } from "react";

type MarketThemeCssVariables = CSSProperties & {
  [key: `--${string}`]: string;
};

export type MarketTheme = {
  id: "new-york" | "los-angeles" | "neutral";
  siteCard: {
    activeClassName: string;
    inactiveClassName: string;
    selectedIndicatorClassName: string;
    trackClassName: string;
    focusClassName: string;
    statusActiveClassName: string;
  };
  slot: {
    cardBackgroundClassName: string;
    cardDefaultClassName: string;
    cardAuthorizingClassName: string;
    cardSubmittedClassName: string;
    accentDefaultClassName: string;
    accentAuthorizingClassName: string;
    accentSubmittedClassName: string;
    statusAuthorizingClassName: string;
    statusSubmittedClassName: string;
    actionReadyClassName: string;
    actionFocusClassName: string;
    controlClassName: string;
    controlWrapperClassName: string;
  };
  billboard: {
    shellClassName: string;
    displayClassName: string;
    atmosphereClassName: string;
    topGlowClassName: string;
    softLightClassName: string;
  };
  liveScreen: {
    shellClassName: string;
    displayClassName: string;
    atmosphereClassName: string;
    haloClassName: string;
    reflectionClassName: string;
  };
  cssVariables: MarketThemeCssVariables;
};

const NEW_YORK_THEME: MarketTheme = {
  id: "new-york",
  siteCard: {
    activeClassName:
      "scale-[1.02] border-cyan-300/80 bg-[linear-gradient(135deg,rgba(8,47,73,0.62),rgba(10,10,10,0.94))] shadow-[0_0_34px_rgba(34,211,238,0.20)]",
    inactiveClassName:
      "border-white/10 bg-neutral-950/85 hover:border-cyan-300/35 hover:bg-neutral-900/90",
    selectedIndicatorClassName:
      "bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.55)]",
    trackClassName: "from-cyan-300/80 via-sky-400/45 to-transparent",
    focusClassName: "focus-visible:outline-cyan-200/80",
    statusActiveClassName:
      "border-cyan-200/20 bg-cyan-200/[0.08] text-cyan-50",
  },
  slot: {
    cardBackgroundClassName:
      "bg-[linear-gradient(135deg,rgba(8,47,73,0.62),rgba(10,10,10,0.94))]",
    cardDefaultClassName:
      "border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.34)] hover:border-cyan-300/15 hover:shadow-[0_22px_58px_rgba(34,211,238,0.055)]",
    cardAuthorizingClassName:
      "border-cyan-300/25 shadow-[0_20px_55px_rgba(34,211,238,0.10)]",
    cardSubmittedClassName:
      "border-cyan-200/20 shadow-[0_20px_55px_rgba(34,211,238,0.08)]",
    accentDefaultClassName:
      "from-cyan-300/45 via-sky-200/20 to-transparent",
    accentAuthorizingClassName:
      "from-cyan-300/65 via-white/20 to-transparent",
    accentSubmittedClassName:
      "from-cyan-200/70 via-sky-300/28 to-transparent",
    statusAuthorizingClassName:
      "border-cyan-200/25 bg-cyan-200/[0.08] text-cyan-50",
    statusSubmittedClassName:
      "border-cyan-200/25 bg-cyan-200/[0.08] text-cyan-50",
    actionReadyClassName:
      "border-cyan-100/55 bg-cyan-50 text-black shadow-[0_14px_30px_rgba(34,211,238,0.12)] hover:bg-white",
    actionFocusClassName: "focus-visible:outline-cyan-100/80",
    controlClassName:
      "focus:border-cyan-200/45 focus:shadow-[0_0_0_1px_rgba(34,211,238,0.22)]",
    controlWrapperClassName:
      "focus-within:border-cyan-200/45 focus-within:shadow-[0_0_0_1px_rgba(34,211,238,0.22)]",
  },
  billboard: {
    shellClassName:
      "border-cyan-200/10 bg-neutral-900 shadow-[0_24px_80px_rgba(34,211,238,0.055)]",
    displayClassName:
      "border-cyan-200/20 shadow-[inset_0_0_40px_rgba(34,211,238,0.055),0_0_42px_rgba(34,211,238,0.055)]",
    atmosphereClassName:
      "bg-[radial-gradient(circle_at_50%_44%,rgba(34,211,238,0.075),transparent_42%),linear-gradient(90deg,rgba(0,0,0,0.5),transparent_30%,transparent_70%,rgba(0,0,0,0.58))]",
    topGlowClassName: "from-cyan-100/[0.105] to-transparent",
    softLightClassName:
      "bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.105),transparent)]",
  },
  liveScreen: {
    shellClassName:
      "border-cyan-200/10 bg-neutral-900 shadow-[0_24px_80px_rgba(34,211,238,0.045)]",
    displayClassName:
      "border-cyan-200/15 bg-black shadow-[inset_0_0_48px_rgba(34,211,238,0.045)]",
    atmosphereClassName:
      "bg-[radial-gradient(circle_at_50%_38%,rgba(34,211,238,0.12),transparent_34%),radial-gradient(circle_at_18%_72%,rgba(59,130,246,0.10),transparent_36%),linear-gradient(180deg,rgba(2,6,23,0.16),rgba(0,0,0,0.72))]",
    haloClassName:
      "bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.16),transparent_62%)]",
    reflectionClassName:
      "bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.08),transparent)]",
  },
  cssVariables: {
    "--market-billboard-glow-primary": "rgba(34, 211, 238, 0.13)",
    "--market-billboard-glow-secondary": "rgba(96, 165, 250, 0.07)",
    "--market-billboard-text-glow": "rgba(34, 211, 238, 0.16)",
    "--market-billboard-shimmer": "rgba(125, 211, 252, 0.22)",
  },
};

const LOS_ANGELES_THEME: MarketTheme = {
  id: "los-angeles",
  siteCard: {
    activeClassName:
      "scale-[1.02] border-fuchsia-300/80 bg-[linear-gradient(135deg,rgba(76,29,149,0.48),rgba(10,10,10,0.94))] shadow-[0_0_34px_rgba(217,70,239,0.18)]",
    inactiveClassName:
      "border-white/10 bg-neutral-950/85 hover:border-fuchsia-300/35 hover:bg-neutral-900/90",
    selectedIndicatorClassName:
      "bg-fuchsia-300 shadow-[0_0_16px_rgba(217,70,239,0.50)]",
    trackClassName: "from-fuchsia-300/80 via-violet-400/45 to-transparent",
    focusClassName: "focus-visible:outline-fuchsia-200/80",
    statusActiveClassName:
      "border-fuchsia-200/20 bg-fuchsia-200/[0.08] text-fuchsia-50",
  },
  slot: {
    cardBackgroundClassName:
      "bg-[linear-gradient(135deg,rgba(76,29,149,0.48),rgba(10,10,10,0.94))]",
    cardDefaultClassName:
      "border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.34)] hover:border-fuchsia-300/15 hover:shadow-[0_22px_58px_rgba(217,70,239,0.055)]",
    cardAuthorizingClassName:
      "border-fuchsia-300/25 shadow-[0_20px_55px_rgba(217,70,239,0.09)]",
    cardSubmittedClassName:
      "border-fuchsia-200/20 shadow-[0_20px_55px_rgba(217,70,239,0.075)]",
    accentDefaultClassName:
      "from-fuchsia-300/45 via-violet-200/20 to-transparent",
    accentAuthorizingClassName:
      "from-fuchsia-300/65 via-white/20 to-transparent",
    accentSubmittedClassName:
      "from-fuchsia-200/70 via-violet-300/28 to-transparent",
    statusAuthorizingClassName:
      "border-fuchsia-200/25 bg-fuchsia-200/[0.08] text-fuchsia-50",
    statusSubmittedClassName:
      "border-fuchsia-200/25 bg-fuchsia-200/[0.08] text-fuchsia-50",
    actionReadyClassName:
      "border-fuchsia-100/55 bg-fuchsia-50 text-black shadow-[0_14px_30px_rgba(217,70,239,0.11)] hover:bg-white",
    actionFocusClassName: "focus-visible:outline-fuchsia-100/80",
    controlClassName:
      "focus:border-fuchsia-200/45 focus:shadow-[0_0_0_1px_rgba(217,70,239,0.20)]",
    controlWrapperClassName:
      "focus-within:border-fuchsia-200/45 focus-within:shadow-[0_0_0_1px_rgba(217,70,239,0.20)]",
  },
  billboard: {
    shellClassName:
      "border-fuchsia-200/10 bg-neutral-900 shadow-[0_24px_80px_rgba(217,70,239,0.05)]",
    displayClassName:
      "border-fuchsia-200/20 shadow-[inset_0_0_40px_rgba(217,70,239,0.05),0_0_42px_rgba(217,70,239,0.05)]",
    atmosphereClassName:
      "bg-[radial-gradient(circle_at_50%_44%,rgba(217,70,239,0.07),transparent_42%),linear-gradient(90deg,rgba(0,0,0,0.52),transparent_30%,transparent_70%,rgba(0,0,0,0.6))]",
    topGlowClassName: "from-fuchsia-100/[0.10] to-transparent",
    softLightClassName:
      "bg-[linear-gradient(90deg,transparent,rgba(233,213,255,0.10),transparent)]",
  },
  liveScreen: {
    shellClassName:
      "border-fuchsia-200/10 bg-neutral-900 shadow-[0_24px_80px_rgba(217,70,239,0.042)]",
    displayClassName:
      "border-fuchsia-200/15 bg-black shadow-[inset_0_0_48px_rgba(217,70,239,0.042)]",
    atmosphereClassName:
      "bg-[radial-gradient(circle_at_52%_38%,rgba(217,70,239,0.105),transparent_34%),radial-gradient(circle_at_82%_72%,rgba(124,58,237,0.11),transparent_36%),linear-gradient(180deg,rgba(24,10,35,0.18),rgba(0,0,0,0.72))]",
    haloClassName:
      "bg-[radial-gradient(ellipse_at_center,rgba(217,70,239,0.14),transparent_62%)]",
    reflectionClassName:
      "bg-[linear-gradient(90deg,transparent,rgba(233,213,255,0.075),transparent)]",
  },
  cssVariables: {
    "--market-billboard-glow-primary": "rgba(217, 70, 239, 0.12)",
    "--market-billboard-glow-secondary": "rgba(124, 58, 237, 0.075)",
    "--market-billboard-text-glow": "rgba(217, 70, 239, 0.15)",
    "--market-billboard-shimmer": "rgba(233, 213, 255, 0.20)",
  },
};

export const FALLBACK_MARKET_THEME: MarketTheme = {
  id: "neutral",
  siteCard: {
    activeClassName:
      "scale-[1.02] border-white/60 bg-[linear-gradient(135deg,rgba(64,64,64,0.54),rgba(10,10,10,0.94))] shadow-[0_0_30px_rgba(255,255,255,0.14)]",
    inactiveClassName:
      "border-white/10 bg-neutral-950/85 hover:border-white/30 hover:bg-neutral-900/90",
    selectedIndicatorClassName:
      "bg-white shadow-[0_0_14px_rgba(255,255,255,0.35)]",
    trackClassName: "from-white/65 via-white/25 to-transparent",
    focusClassName: "focus-visible:outline-white/70",
    statusActiveClassName:
      "border-white/15 bg-white/[0.08] text-white/85",
  },
  slot: {
    cardBackgroundClassName:
      "bg-[linear-gradient(135deg,rgba(64,64,64,0.54),rgba(10,10,10,0.94))]",
    cardDefaultClassName:
      "border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.34)] hover:border-white/15",
    cardAuthorizingClassName:
      "border-white/20 shadow-[0_20px_55px_rgba(255,255,255,0.07)]",
    cardSubmittedClassName:
      "border-white/20 shadow-[0_20px_55px_rgba(255,255,255,0.07)]",
    accentDefaultClassName: "from-white/35 via-white/15 to-transparent",
    accentAuthorizingClassName: "from-white/55 via-white/20 to-transparent",
    accentSubmittedClassName: "from-white/60 via-white/20 to-transparent",
    statusAuthorizingClassName:
      "border-white/15 bg-white/[0.06] text-white/80",
    statusSubmittedClassName:
      "border-white/15 bg-white/[0.06] text-white/80",
    actionReadyClassName:
      "border-white/25 bg-white text-black shadow-[0_14px_30px_rgba(255,255,255,0.08)] hover:bg-white/90",
    actionFocusClassName: "focus-visible:outline-white/70",
    controlClassName:
      "focus:border-white/40 focus:shadow-[0_0_0_1px_rgba(255,255,255,0.16)]",
    controlWrapperClassName:
      "focus-within:border-white/40 focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.16)]",
  },
  billboard: {
    shellClassName:
      "border-neutral-800 bg-neutral-900 shadow-[0_24px_80px_rgba(255,255,255,0.035)]",
    displayClassName:
      "border-neutral-700 shadow-[inset_0_0_40px_rgba(255,255,255,0.035)]",
    atmosphereClassName:
      "bg-[radial-gradient(circle_at_50%_44%,rgba(255,255,255,0.065),transparent_42%),linear-gradient(90deg,rgba(0,0,0,0.5),transparent_30%,transparent_70%,rgba(0,0,0,0.58))]",
    topGlowClassName: "from-white/[0.095] to-transparent",
    softLightClassName:
      "bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.075),transparent)]",
  },
  liveScreen: {
    shellClassName: "border-neutral-800 bg-neutral-900",
    displayClassName: "border-neutral-700 bg-black",
    atmosphereClassName:
      "bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.06),transparent_34%),linear-gradient(180deg,rgba(23,23,23,0.14),rgba(0,0,0,0.72))]",
    haloClassName:
      "bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_62%)]",
    reflectionClassName:
      "bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)]",
  },
  cssVariables: {
    "--market-billboard-glow-primary": "rgba(79, 140, 255, 0.12)",
    "--market-billboard-glow-secondary": "rgba(255, 255, 255, 0.055)",
    "--market-billboard-text-glow": "rgba(148, 163, 184, 0.10)",
    "--market-billboard-shimmer": "rgba(203, 213, 225, 0.18)",
  },
};

const SITE_THEME_KEYS = {
  "new-york/times-square": "new-york",
  "los-angeles/hollywood-boulevard": "los-angeles",
} as const;

const MARKET_THEMES = {
  "new-york": NEW_YORK_THEME,
  "los-angeles": LOS_ANGELES_THEME,
} as const satisfies Record<
  (typeof SITE_THEME_KEYS)[keyof typeof SITE_THEME_KEYS],
  MarketTheme
>;

export function getMarketTheme(siteKey: string): MarketTheme {
  const themeKey =
    SITE_THEME_KEYS[siteKey as keyof typeof SITE_THEME_KEYS] ?? null;

  return themeKey ? MARKET_THEMES[themeKey] : FALLBACK_MARKET_THEME;
}
