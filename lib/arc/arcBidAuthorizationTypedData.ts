import { isAddress, type Address } from "viem";

import type { BidAuthorizationPayload } from "@/lib/auction/auctionTypes";
import { ARC_CHAIN_ID } from "./arcConstants";

const bidAuthorizationTypes = {
  BidAuthorization: [
    { name: "purpose", type: "string" },
    { name: "version", type: "string" },
    { name: "marketId", type: "string" },
    { name: "siteId", type: "string" },
    { name: "advertiserAddress", type: "address" },
    { name: "businessName", type: "string" },
    { name: "advertisementName", type: "string" },
    { name: "slotId", type: "string" },
    { name: "cycleId", type: "string" },
    { name: "bidAmountMinorUnits", type: "uint256" },
    { name: "chainId", type: "uint256" },
    { name: "escrowAddress", type: "address" },
    { name: "treasuryAddress", type: "address" },
    { name: "usdcAddress", type: "address" },
    { name: "expiresAt", type: "string" },
  ],
} as const;

const decimalIntegerPattern = /^(0|[1-9]\d*)$/;
const uint256Max = (BigInt(1) << BigInt(256)) - BigInt(1);

function assertNonEmptyString(value: string, fieldName: string) {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
}

function assertAddress(value: Address, fieldName: string) {
  if (!isAddress(value)) {
    throw new Error(`${fieldName} must be a valid EVM address.`);
  }
}

export function parseBidAuthorizationUint256(
  value: string,
  fieldName: string
) {
  if (!decimalIntegerPattern.test(value)) {
    throw new Error(`${fieldName} must be a decimal integer string.`);
  }

  const parsedValue = BigInt(value);

  if (parsedValue <= BigInt(0)) {
    throw new RangeError(`${fieldName} must be greater than zero.`);
  }

  if (parsedValue > uint256Max) {
    throw new RangeError(`${fieldName} exceeds uint256.`);
  }

  return parsedValue;
}

function assertBidAuthorizationPayload(payload: BidAuthorizationPayload) {
  if (payload.purpose !== "PDOOH_BID_AUTHORIZATION") {
    throw new Error("Bid authorization purpose is invalid.");
  }

  if (payload.version !== "2") {
    throw new Error("Bid authorization version is invalid.");
  }

  if (payload.chainId !== ARC_CHAIN_ID) {
    throw new Error("Bid authorization chain must be Arc Testnet.");
  }

  assertAddress(payload.advertiserAddress, "advertiserAddress");
  assertAddress(payload.escrowAddress, "escrowAddress");
  assertAddress(payload.treasuryAddress, "treasuryAddress");
  assertAddress(payload.usdcAddress, "usdcAddress");
  assertNonEmptyString(payload.marketId, "marketId");
  assertNonEmptyString(payload.siteId, "siteId");
  assertNonEmptyString(payload.businessName, "businessName");
  assertNonEmptyString(payload.advertisementName, "advertisementName");
  assertNonEmptyString(payload.slotId, "slotId");
  assertNonEmptyString(payload.cycleId, "cycleId");
  parseBidAuthorizationUint256(
    payload.bidAmountMinorUnits,
    "bidAmountMinorUnits"
  );
  assertNonEmptyString(payload.expiresAt, "expiresAt");

  if (Number.isNaN(Date.parse(payload.expiresAt))) {
    throw new Error("expiresAt must be a valid timestamp.");
  }
}

export function createBidAuthorizationTypedData(
  payload: BidAuthorizationPayload
) {
  assertBidAuthorizationPayload(payload);

  return {
    domain: {
      name: "pDOOH",
      version: payload.version,
      chainId: payload.chainId,
      verifyingContract: payload.escrowAddress,
    },
    types: bidAuthorizationTypes,
    primaryType: "BidAuthorization",
    message: {
      purpose: payload.purpose,
      version: payload.version,
      marketId: payload.marketId,
      siteId: payload.siteId,
      advertiserAddress: payload.advertiserAddress,
      businessName: payload.businessName,
      advertisementName: payload.advertisementName,
      slotId: payload.slotId,
      cycleId: payload.cycleId,
      bidAmountMinorUnits: parseBidAuthorizationUint256(
        payload.bidAmountMinorUnits,
        "bidAmountMinorUnits"
      ),
      chainId: BigInt(payload.chainId),
      escrowAddress: payload.escrowAddress,
      treasuryAddress: payload.treasuryAddress,
      usdcAddress: payload.usdcAddress,
      expiresAt: payload.expiresAt,
    },
  } as const;
}
