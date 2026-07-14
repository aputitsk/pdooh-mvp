import type { SettlementRecord } from "./settlementRecords";
import {
  formatUSDCFromMinorUnits,
  USDC_DECIMALS,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

const LAST_SETTLEMENT_DISPLAY_DECIMALS = 3;

export function isSuccessfulSettlement(record: SettlementRecord) {
  return record.status === "settled";
}

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

export function formatLastSettlementAmount(amount: bigint) {
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

export function formatSettlementRevenue(amount: UsdcMinorUnits) {
  return formatUSDCFromMinorUnits(amount);
}

export function formatTransactionHash(transactionHash: string) {
  return `${transactionHash.slice(0, 6)}...${transactionHash.slice(-4)}`;
}

export function getPlatformRevenue(records: readonly SettlementRecord[]) {
  return records.filter(isSuccessfulSettlement).reduce<UsdcMinorUnits>(
    (total, record) => addSafeMinorUnits(total, record.result.amountMinorUnits),
    0
  );
}

export function getAccountSettlementRecords(
  records: readonly SettlementRecord[],
  accountAddress: string | null | undefined
) {
  if (!accountAddress) {
    return [];
  }

  const normalizedAccountAddress = accountAddress.toLowerCase();

  return records.filter((record) => {
    return (
      record.result.advertiserAddress.toLowerCase() ===
      normalizedAccountAddress
    );
  });
}

export function getLastSuccessfulSettlement(
  records: readonly SettlementRecord[]
) {
  return records.filter(isSuccessfulSettlement).sort((first, second) => {
    return Date.parse(second.updatedAt) - Date.parse(first.updatedAt);
  })[0];
}
