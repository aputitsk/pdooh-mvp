import type { UsdcMinorUnits } from "@/lib/money/usdc";
import type { SettlementRecord } from "./settlementRecords";

export const MISSING_BID_AUTHORIZATION_FAILURE_REASON =
  "Settlement is missing bid authorization and cannot be processed.";
export const SETTLEMENT_WINDOW_CLOSED_FAILURE_REASON =
  "Settlement window is not open for this cycle and slot.";

function addSafeMinorUnits(
  current: UsdcMinorUnits,
  amount: UsdcMinorUnits
): UsdcMinorUnits {
  const next = current + amount;
  return Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
}

function toSafeMinorUnits(value: bigint): UsdcMinorUnits | null {
  if (value <= BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return Number(value);
}

export function isRetryableFailedSettlementRecord(
  record: SettlementRecord
): boolean {
  return (
    record.status === "failed" &&
    Boolean(record.result.bidAuthorization) &&
    record.failureReason !== MISSING_BID_AUTHORIZATION_FAILURE_REASON &&
    record.failureReason !== SETTLEMENT_WINDOW_CLOSED_FAILURE_REASON
  );
}

function reservesAdvertiserFunds(record: SettlementRecord): boolean {
  if (!record.result.bidAuthorization) {
    return false;
  }

  return (
    record.status === "pending" ||
    record.status === "processing" ||
    isRetryableFailedSettlementRecord(record)
  );
}

export function getUnresolvedSettlementReservedAmount(
  settlementRecords: readonly SettlementRecord[],
  advertiserAddress: `0x${string}` | string | null
): UsdcMinorUnits {
  if (!advertiserAddress) {
    return 0;
  }

  const normalizedAdvertiserAddress = advertiserAddress.toLowerCase();

  return settlementRecords.reduce<UsdcMinorUnits>((total, record) => {
    if (
      record.result.advertiserAddress.toLowerCase() !==
        normalizedAdvertiserAddress ||
      !reservesAdvertiserFunds(record)
    ) {
      return total;
    }

    const amount = toSafeMinorUnits(record.result.amountMinorUnits);

    return amount === null ? total : addSafeMinorUnits(total, amount);
  }, 0);
}
