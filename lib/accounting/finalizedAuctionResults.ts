import { isAddress } from "viem";

import type { SignedBidAuthorization } from "@/lib/auction";
import type { FinalizedAuctionResult } from "./settlementRecords";

type CreateFinalizedAuctionResultParams = {
  chainId: number;
  escrowAddress: `0x${string}`;
  treasuryAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  cycleId: string;
  slotId: string;
  advertiserAddress: `0x${string}` | null;
  businessName: string;
  advertisementName: string;
  amountMinorUnits: number;
  bidAuthorization: SignedBidAuthorization | null;
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

  if (params.bidAuthorization === null) {
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
    !isNonEmptyString(params.businessName) ||
    !isNonEmptyString(params.advertisementName)
  ) {
    return null;
  }

  if (
    !isAddress(params.escrowAddress) ||
    !isAddress(params.treasuryAddress) ||
    !isAddress(params.usdcAddress) ||
    !isAddress(params.advertiserAddress)
  ) {
    return null;
  }

  return {
    chainId: params.chainId,
    escrowAddress: params.escrowAddress,
    treasuryAddress: params.treasuryAddress,
    usdcAddress: params.usdcAddress,
    cycleId: params.cycleId,
    slotId: params.slotId,
    advertiserAddress: params.advertiserAddress,
    businessName: params.businessName,
    advertisementName: params.advertisementName,
    amountMinorUnits: BigInt(params.amountMinorUnits),
    bidAuthorization: {
      payload: { ...params.bidAuthorization.payload },
      signature: params.bidAuthorization.signature,
    },
  };
}
