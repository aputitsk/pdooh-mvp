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
  record: SettlementRecord,
  nowMs = Date.now()
): boolean {
  if (record.status !== "failed_retryable" || !record.result.bidAuthorization) {
    return false;
  }

  const expiresAtMs = Date.parse(record.result.bidAuthorization.payload.expiresAt);

  return (
    Number.isFinite(expiresAtMs) &&
    expiresAtMs > nowMs
  );
}

function reservesAdvertiserFunds(
  record: SettlementRecord,
  nowMs: number
): boolean {
  if (!record.result.bidAuthorization) {
    return false;
  }

  return (
    record.status === "pending_playback" ||
    record.status === "ready_to_settle" ||
    record.status === "processing" ||
    isRetryableFailedSettlementRecord(record, nowMs)
  );
}

export function getUnresolvedSettlementReservedAmount(
  settlementRecords: readonly SettlementRecord[],
  advertiserAddress: `0x${string}` | string | null,
  nowMs = Date.now()
): UsdcMinorUnits {
  if (!advertiserAddress) {
    return 0;
  }

  const normalizedAdvertiserAddress = advertiserAddress.toLowerCase();

  return settlementRecords.reduce<UsdcMinorUnits>((total, record) => {
    if (
      record.result.advertiserAddress.toLowerCase() !==
        normalizedAdvertiserAddress ||
      !reservesAdvertiserFunds(record, nowMs)
    ) {
      return total;
    }

    const amount = toSafeMinorUnits(record.result.amountMinorUnits);

    return amount === null ? total : addSafeMinorUnits(total, amount);
  }, 0);
}
