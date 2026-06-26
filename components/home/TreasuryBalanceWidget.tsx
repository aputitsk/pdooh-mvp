"use client";

import { useEffect, useState } from "react";
import { createBrowserSettlementRepository } from "@/lib/accounting/settlementRepository";
import { formatUSDCFromMinorUnits } from "@/lib/money/usdc";

function getSettledTreasuryBalance() {
  try {
    const repository = createBrowserSettlementRepository();

    return repository.listByStatus("settled").reduce((total, record) => {
      const next = total + Number(record.result.amountMinorUnits);
      return Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
    }, 0);
  } catch {
    return 0;
  }
}

export default function TreasuryBalanceWidget() {
  const [treasuryBalance, setTreasuryBalance] = useState(0);

  useEffect(() => {
    const syncTreasuryBalance = () => {
      setTreasuryBalance(getSettledTreasuryBalance());
    };
    const interval = window.setInterval(syncTreasuryBalance, 1_000);

    syncTreasuryBalance();

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center shadow-sm shadow-black/10">
      <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">
        Treasury Balance
      </p>
      <p className="mt-0.5 text-sm font-bold text-white">
        {formatUSDCFromMinorUnits(treasuryBalance)} Test USDC
      </p>
      <p className="mt-0.5 text-[10px] leading-4 text-white/35">
        Platform advertising revenue
      </p>
    </div>
  );
}
