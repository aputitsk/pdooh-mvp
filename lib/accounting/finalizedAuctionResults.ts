import { isAddress } from "viem";

import type { FinalizedAuctionResult } from "./settlementRecords";

type CreateFinalizedAuctionResultParams = {
  chainId: number;
  escrowAddress: `0x${string}`;
  cycleId: string;
  slotId: string;
  advertiserAddress: `0x${string}` | null;
  advertisementName: string;
  amountMinorUnits: number;
};

function isNonEmptyString(value: string) {
  return value.trim().length > 0;
}

export function createFinalizedAuctionResult(
  params: CreateFinalizedAuctionResultParams
): FinalizedAuctionResult | null {
  if (params.advertiserAddress === null) {
    return null;
  }

  if (
    !Number.isSafeInteger(params.amountMinorUnits) ||
    params.amountMinorUnits <= 0
  ) {
    return null;
  }

  if (
    !isNonEmptyString(params.cycleId) ||
    !isNonEmptyString(params.slotId) ||
    !isNonEmptyString(params.advertisementName)
  ) {
    return null;
  }

  if (
    !isAddress(params.escrowAddress) ||
    !isAddress(params.advertiserAddress)
  ) {
    return null;
  }

  return {
    chainId: params.chainId,
    escrowAddress: params.escrowAddress,
    cycleId: params.cycleId,
    slotId: params.slotId,
    advertiserAddress: params.advertiserAddress,
    advertisementName: params.advertisementName,
    amountMinorUnits: BigInt(params.amountMinorUnits),
  };
}
