"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import WalletButton from "@/components/layout/WalletButton";

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

export default function Navbar() {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  if (isLandingPage) {
    return (
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-white">
        <Link href="/" className="text-xl font-bold">
          pDOOH
        </Link>

        <Link
          href="/advertiser"
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-neutral-200"
        >
          Launch App
        </Link>
      </nav>
    );
  }

  return (
    <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-white">
      <Link href="/" className="text-xl font-bold">
        pDOOH
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
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}

        <WalletButton />
      </div>
    </nav>
  );
}
