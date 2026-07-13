"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getArcFeeSignalSnapshot,
  getServerArcFeeSignalSnapshot,
  refreshArcFeeSignal,
  subscribeToArcFeeSignal,
} from "@/lib/arc/arcFeeSignal";
import MoneyAmount from "@/components/ui/MoneyAmount";
import styles from "./ArcFeeSignal.module.css";

function renderFeeDisplay(display: string) {
  const match = display.match(/^(\u2248\s*)(<)?(\d+(?:\.\d+)?)(\s+USDC)$/);

  if (!match) {
    return display;
  }

  const [, prefix, lessThan = "", amount] = match;

  return (
    <>
      {prefix}
      {lessThan}
      <MoneyAmount amount={amount} unit="USDC" />
    </>
  );
}

export default function ArcFeeSignal() {
  const arcFeeSignal = useSyncExternalStore(
    subscribeToArcFeeSignal,
    getArcFeeSignalSnapshot,
    getServerArcFeeSignalSnapshot
  );
  const label =
    arcFeeSignal.status === "ready" && arcFeeSignal.display
      ? (
          <>
            Arc Testnet {"\u00b7"} Gas {renderFeeDisplay(arcFeeSignal.display)}
          </>
        )
      : arcFeeSignal.status === "error"
        ? "Arc Testnet \u00b7 Gas unavailable"
        : "Arc Testnet \u00b7 Fees in USDC";

  useEffect(() => {
    void refreshArcFeeSignal();
  }, []);

  return (
    <div className={styles.feeSignal}>
      <p>{label}</p>
      <span aria-hidden="true" className={styles.feeSignalPulse} />
    </div>
  );
}
