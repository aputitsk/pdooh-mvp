"use client";

import Link from "next/link";
import WalletButton from "@/components/layout/WalletButton";
import { useWalletStore } from "@/lib/wallet";

export default function LandingLaunchControl() {
  const wallet = useWalletStore();

  if (wallet.status === "restoring") {
    return (
      <div className="h-9 w-[112px] rounded-full border border-white/10 bg-white/10" />
    );
  }

  if (wallet.connected && wallet.address) {
    return <WalletButton />;
  }

  return (
    <Link
      href="/advertiser"
      className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-neutral-200"
    >
      Launch App
    </Link>
  );
}
