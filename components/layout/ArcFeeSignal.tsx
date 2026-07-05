"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getArcFeeSignalSnapshot,
  getServerArcFeeSignalSnapshot,
  refreshArcFeeSignal,
  subscribeToArcFeeSignal,
} from "@/lib/arc/arcFeeSignal";
import styles from "./ArcFeeSignal.module.css";

export default function ArcFeeSignal() {
  const arcFeeSignal = useSyncExternalStore(
    subscribeToArcFeeSignal,
    getArcFeeSignalSnapshot,
    getServerArcFeeSignalSnapshot
  );
  const label =
    arcFeeSignal.status === "ready" && arcFeeSignal.display
      ? `Arc Testnet \u00b7 Gas ${arcFeeSignal.display}`
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
