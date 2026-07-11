"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import LandingLaunchControl from "@/components/layout/LandingLaunchControl";
import WalletButton from "@/components/layout/WalletButton";
import styles from "./Navbar.module.css";

const appLinks = [
  {
    label: "Advertiser",
    mobileLabel: "Advertiser",
    href: "/advertiser",
  },
  {
    label: "Advertisements",
    mobileLabel: "Ads",
    href: "/advertisements",
  },
  {
    label: "Auction",
    mobileLabel: "Auction",
    href: "/screen",
  },
];

function BrandLogo() {
  return (
    <span className="flex items-center gap-3">
      <img
        src="/logo27.png"
        alt="pDOOH"
        className="h-17 w-auto shrink-1"
        draggable={false}
      />

      <span className="text-xl font-bold tracking-tight text-white">
        pDOOH
      </span>
    </span>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  if (isLandingPage) {
    return (
      <nav className={styles.navShell}>
        <div
          className={`${styles.glassPanel} ${styles.navPanel} mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 py-4 text-white sm:flex-row sm:justify-between sm:px-6 sm:py-5`}
        >
          <div className={styles.primaryRow}>
            <Link href="/" aria-label="pDOOH Home" className={styles.brandLink}>
              <BrandLogo />
            </Link>
          </div>

          <div className={styles.actionGroup}>
            <div className={`${styles.linksRow} flex w-full flex-wrap items-center justify-center gap-1.5 sm:w-auto sm:justify-end sm:gap-2`}>
              {appLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${styles.navLink} rounded-full px-3 py-2 text-xs font-medium text-[#CFE8FF] transition hover:bg-white/[0.06] hover:text-[#CFE8FF] sm:px-4 sm:text-sm`}
                >
                  <span className={styles.fullLabel}>{link.label}</span>
                  <span className={styles.mobileLabel}>{link.mobileLabel}</span>
                </Link>
              ))}
            </div>

            <div className={styles.navAction}>
              <LandingLaunchControl />
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className={styles.navShell}>
      <div
        className={`${styles.glassPanel} ${styles.navPanel} mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 py-4 text-white sm:flex-row sm:justify-between sm:px-6 sm:py-5`}
      >
        <div className={styles.primaryRow}>
          <Link href="/" aria-label="pDOOH Home" className={styles.brandLink}>
            <BrandLogo />
          </Link>
        </div>

        <div className={styles.actionGroup}>
          <div className={`${styles.linksRow} flex w-full flex-wrap items-center justify-center gap-1.5 sm:w-auto sm:justify-end sm:gap-2`}>
            {appLinks.map((link) => {
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${styles.navLink} rounded-full px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                    isActive
                      ? `${styles.navLinkActive} text-[#CFE8FF]`
                      : "text-[#CFE8FF] hover:bg-white/[0.06] hover:text-[#CFE8FF]"
                  }`}
                >
                  <span className={styles.fullLabel}>{link.label}</span>
                  <span className={styles.mobileLabel}>{link.mobileLabel}</span>
                </Link>
              );
            })}
          </div>

          <div className={styles.navAction}>
            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
