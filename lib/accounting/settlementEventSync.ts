import {
  listArcSettlementEvents,
  type ArcSettlementEvent,
} from "@/lib/arc/arcSettlementEvents";
import type { UsdcMinorUnits } from "@/lib/money/usdc";

export type SettlementEventSummary = {
  platformRevenue: UsdcMinorUnits;
  lastSettlement: ArcSettlementEvent | null;
};

function addSafeMinorUnits(
  current: UsdcMinorUnits,
  amount: bigint
): UsdcMinorUnits {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.MAX_SAFE_INTEGER;
  }

  const next = current + Number(amount);
  return Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
}

function compareSettlementEvents(
  first: ArcSettlementEvent,
  second: ArcSettlementEvent
) {
  if (first.blockNumber !== second.blockNumber) {
    return first.blockNumber > second.blockNumber ? 1 : -1;
  }

  return first.logIndex - second.logIndex;
}

export async function getSettlementEventSummary(): Promise<SettlementEventSummary> {
  const settlementEvents = await listArcSettlementEvents();
  const platformRevenue = settlementEvents.reduce<UsdcMinorUnits>(
    (total, settlementEvent) =>
      addSafeMinorUnits(total, settlementEvent.amountMinorUnits),
    0
  );
  const lastSettlement =
    settlementEvents.length === 0
      ? null
      : [...settlementEvents].sort(compareSettlementEvents).at(-1) ?? null;

  return {
    platformRevenue,
    lastSettlement,
  };
}
