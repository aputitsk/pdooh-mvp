import type { SettlementRecord } from "./settlementRecords";
import type { UsdcMinorUnits } from "@/lib/money/usdc";

type DeriveActiveSlotReservedAmountParams = {
  cycleId: number | string;
  advertiserAddress: `0x${string}` | null;
  slotIds: readonly string[];
  winnerBidAmounts: readonly UsdcMinorUnits[];
  winnerAdvertiserAddresses: readonly (`0x${string}` | null)[];
  settlementRecords: readonly SettlementRecord[];
  reflectedSettledAmount?: UsdcMinorUnits;
};

function addSafeMinorUnits(
  current: UsdcMinorUnits,
  amount: UsdcMinorUnits
): UsdcMinorUnits {
  const next = current + amount;
  return Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
}

function getSettledAmount(params: {
  cycleId: string;
  advertiserAddress: `0x${string}`;
  settlementRecords: readonly SettlementRecord[];
}): UsdcMinorUnits {
  const normalizedAdvertiserAddress = params.advertiserAddress.toLowerCase();

  return params.settlementRecords.reduce<UsdcMinorUnits>((total, record) => {
    if (
      record.status !== "settled" ||
      record.result.cycleId !== params.cycleId ||
      record.result.advertiserAddress.toLowerCase() !==
        normalizedAdvertiserAddress
    ) {
      return total;
    }

    return addSafeMinorUnits(total, Number(record.result.amountMinorUnits));
  }, 0);
}

export function deriveActiveSlotReservedAmount({
  cycleId,
  advertiserAddress,
  slotIds,
  winnerBidAmounts,
  winnerAdvertiserAddresses,
  settlementRecords,
  reflectedSettledAmount = 0,
}: DeriveActiveSlotReservedAmountParams): UsdcMinorUnits {
  if (!advertiserAddress) {
    return 0;
  }

  const normalizedAdvertiserAddress = advertiserAddress.toLowerCase();
  const settledAmount = getSettledAmount({
    cycleId: String(cycleId),
    advertiserAddress,
    settlementRecords,
  });
  const reflectedAmount = Math.min(settledAmount, reflectedSettledAmount);

  const winningAmount = slotIds.reduce<UsdcMinorUnits>((total, _slotId, slotIndex) => {
    const winnerAdvertiserAddress = winnerAdvertiserAddresses[slotIndex];
    const amount = winnerBidAmounts[slotIndex] ?? 0;

    if (
      !winnerAdvertiserAddress ||
      winnerAdvertiserAddress.toLowerCase() !== normalizedAdvertiserAddress ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      return total;
    }

    return addSafeMinorUnits(total, amount);
  }, 0);

  return Math.max(winningAmount - reflectedAmount, 0);
}
