import type { SlotState } from "./auctionTypes";
import type { UsdcMinorUnits } from "@/lib/money/usdc";
import { parseUSDCToMinorUnits } from "@/lib/money/usdc";

export function getConfirmedBidExposure(
  slotStates: SlotState[],
  submittedBids: boolean[]
): UsdcMinorUnits {
  return slotStates.reduce<UsdcMinorUnits>(
    (totalExposure, slotState, slotIndex) => {
      if (!submittedBids[slotIndex]) {
        return totalExposure;
      }

      return addSafeMinorUnits(totalExposure, getSlotBidAmount(slotState.bid));
    },
    0
  );
}

export function getBidExposureWithCandidate(params: {
  slotIndex: number;
  slotStates: SlotState[];
  submittedBids: boolean[];
}): UsdcMinorUnits {
  const { slotIndex, slotStates, submittedBids } = params;
  const confirmedExposure = getConfirmedBidExposure(
    slotStates,
    submittedBids
  );

  if (submittedBids[slotIndex]) {
    return confirmedExposure;
  }

  return addSafeMinorUnits(
    confirmedExposure,
    getSlotBidAmount(slotStates[slotIndex]?.bid ?? "")
  );
}

export function getTypedBidExposureThroughSlot(
  slotStates: SlotState[],
  slotIndex: number
): UsdcMinorUnits {
  return slotStates.reduce<UsdcMinorUnits>(
    (totalExposure, slotState, currentSlotIndex) => {
      if (currentSlotIndex > slotIndex) {
        return totalExposure;
      }

      return addSafeMinorUnits(totalExposure, getSlotBidAmount(slotState.bid));
    },
    0
  );
}

function addSafeMinorUnits(
  current: UsdcMinorUnits,
  amount: UsdcMinorUnits
): UsdcMinorUnits {
  const next = current + amount;
  return Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
}

function getSlotBidAmount(bid: string): UsdcMinorUnits {
  if (!bid) {
    return 0;
  }

  try {
    return parseUSDCToMinorUnits(bid);
  } catch {
    return 0;
  }
}
