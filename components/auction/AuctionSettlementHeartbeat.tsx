"use client";

import { useEffect } from "react";

import { runSiteSettlementScanner } from "@/lib/auction/siteSettlementScanner";
import { useWalletStore } from "@/lib/wallet";

const HEARTBEAT_INTERVAL_MS = 1000;

export default function AuctionSettlementHeartbeat() {
  const wallet = useWalletStore();

  useEffect(() => {
    let isRunning = false;

    const runScanner = () => {
      if (isRunning) {
        return;
      }

      isRunning = true;
      void runSiteSettlementScanner(wallet.address).finally(() => {
        isRunning = false;
      });
    };

    runScanner();
    const intervalId = window.setInterval(
      runScanner,
      HEARTBEAT_INTERVAL_MS
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [wallet.address]);

  return null;
}
