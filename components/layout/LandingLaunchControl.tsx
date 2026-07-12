"use client";

import Link from "next/link";
import WalletButton from "@/components/layout/WalletButton";
import operationalStyles from "@/components/ui/OperationalPanel.module.css";
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
      className={`${operationalStyles.navPrimaryAction} inline-flex min-h-10 items-center justify-center px-5 py-2 text-sm font-semibold`}
    >
      Launch App
    </Link>
  );
}
