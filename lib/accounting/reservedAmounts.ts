import type { SiteKey } from "../auction/auctionTypes";
import type { UsdcMinorUnits } from "../money/usdc";

export type SiteReservedAmount = {
  siteKey: SiteKey;
  reservedAmount: UsdcMinorUnits;
};

type TotalReservedAmountParams = {
  siteReservedAmounts: readonly SiteReservedAmount[];
  legacyUnresolvedSettlementReservedAmount?: UsdcMinorUnits;
  pendingSettledReservedAmount?: UsdcMinorUnits;
};

function addSafeMinorUnits(
  current: UsdcMinorUnits,
  amount: UsdcMinorUnits
): UsdcMinorUnits {
  const next = current + amount;
  return Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
}

export function getTotalSiteReservedAmount(
  siteReservedAmounts: readonly SiteReservedAmount[]
): UsdcMinorUnits {
  return siteReservedAmounts.reduce<UsdcMinorUnits>(
    (total, siteReservedAmount) =>
      addSafeMinorUnits(total, siteReservedAmount.reservedAmount),
    0
  );
}

export function getTotalReservedAmount({
  siteReservedAmounts,
  legacyUnresolvedSettlementReservedAmount = 0,
  pendingSettledReservedAmount = 0,
}: TotalReservedAmountParams): UsdcMinorUnits {
  return [
    getTotalSiteReservedAmount(siteReservedAmounts),
    legacyUnresolvedSettlementReservedAmount,
    pendingSettledReservedAmount,
  ].reduce<UsdcMinorUnits>(addSafeMinorUnits, 0);
}

export function getAvailableFromEscrowBalance(
  escrowBalance: UsdcMinorUnits | null,
  totalReservedAmount: UsdcMinorUnits
): UsdcMinorUnits {
  if (escrowBalance === null) {
    return 0;
  }

  return Math.max(escrowBalance - totalReservedAmount, 0);
}
