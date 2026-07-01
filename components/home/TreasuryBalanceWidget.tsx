"use client";

import { useEffect, useState } from "react";
import {
  getSettlementEventSummary,
  type SettlementEventSummary,
} from "@/lib/accounting/settlementEventSync";
import {
  formatUSDCFromMinorUnits,
  USDC_DECIMALS,
} from "@/lib/money/usdc";

const LAST_SETTLEMENT_DISPLAY_DECIMALS = 3;
const SETTLEMENT_REFRESH_INTERVAL_MS = 30000;
const emptySettlementSummary: SettlementEventSummary = {
  platformRevenue: 0,
  lastSettlement: null,
};

function formatLastSettlementAmount(amount: bigint) {
  const displayScale = BigInt(10 ** LAST_SETTLEMENT_DISPLAY_DECIMALS);
  const minorUnitScale = BigInt(
    10 ** (USDC_DECIMALS - LAST_SETTLEMENT_DISPLAY_DECIMALS)
  );
  const roundedDisplayUnits =
    (amount + minorUnitScale / BigInt(2)) / minorUnitScale;
  const wholePart = roundedDisplayUnits / displayScale;
  const fractionalPart = roundedDisplayUnits % displayScale;

  return `${wholePart}.${fractionalPart
    .toString()
    .padStart(LAST_SETTLEMENT_DISPLAY_DECIMALS, "0")}`;
}

export default function TreasuryBalanceWidget() {
  const [settlementSummary, setSettlementSummary] =
    useState<SettlementEventSummary>(emptySettlementSummary);
  const [settlementReadError, setSettlementReadError] = useState<string | null>(
    null
  );

  useEffect(() => {
    let isCurrentRequest = true;

    async function refreshSettlementSummary() {
      try {
        const nextSettlementSummary = await getSettlementEventSummary();

        if (!isCurrentRequest) {
          return;
        }

        setSettlementSummary(nextSettlementSummary);
        setSettlementReadError(null);
      } catch (error) {
        console.error("Unable to read on-chain settlement events.", error);

        if (isCurrentRequest) {
          setSettlementReadError("Unable to read revenue");
        }
      }
    }

    void refreshSettlementSummary();
    const intervalId = window.setInterval(
      refreshSettlementSummary,
      SETTLEMENT_REFRESH_INTERVAL_MS
    );

    return () => {
      isCurrentRequest = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const { platformRevenue, lastSettlement } = settlementSummary;
  const platformRevenueText = settlementReadError
    ? settlementReadError
    : `${formatUSDCFromMinorUnits(platformRevenue)} Test USDC`;

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center shadow-sm shadow-black/10">
      <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">
        Platform Revenue
      </p>
      <p className="mt-0.5 text-sm font-bold text-white">
        {platformRevenueText}
      </p>
      <p
        className={`mt-0.5 text-[10px] leading-4 ${
          !settlementReadError && lastSettlement
            ? "text-emerald-400"
            : "text-white/35"
        }`}
      >
        {settlementReadError
          ? "Settlement data unavailable"
          : lastSettlement
          ? `+${formatLastSettlementAmount(
              lastSettlement.amountMinorUnits
            )} USDC  Last settlement`
          : "No settlements yet"}
      </p>
    </div>
  );
}
