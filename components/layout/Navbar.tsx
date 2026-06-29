"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import WalletButton from "@/components/layout/WalletButton";
import styles from "./Navbar.module.css";

const appLinks = [
  {
    label: "Advertiser",
    href: "/advertiser",
  },
  {
    label: "Advertisements",
    href: "/advertisements",
  },
  {
    label: "Auction",
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
          className={`${styles.glassPanel} mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 text-white`}
        >
          <Link href="/" aria-label="pDOOH Home">
            <BrandLogo />
          </Link>

          <Link
            href="/advertiser"
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-neutral-200"
          >
            Launch App
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className={styles.navShell}>
      <div
        className={`${styles.glassPanel} mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 text-white`}
      >
        <Link href="/" aria-label="pDOOH Home">
          <BrandLogo />
        </Link>

        <div className="flex items-center gap-2">
          {appLinks.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-white text-black"
                    : "text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          <WalletButton />
        </div>
      </div>
    </nav>
  );
}
