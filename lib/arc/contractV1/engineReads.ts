import { getAddress, isAddress, type Address } from "viem";

import { auctionEngineV1ReadAbi } from "./abi";
import { arcPublicClient } from "../rpc/publicClient";
import type { ContractV1ReadClient } from "./escrowReads";
import type {
  ContractV1Bytes32,
  ContractV1CycleSnapshot,
  ContractV1EngineStaticConfig,
  ContractV1SiteConfig,
  ContractV1SlotDiagnostic,
  ContractV1SlotState,
} from "./types";

function asBigInt(value: unknown, fieldName: string) {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }

  throw new TypeError(`${fieldName} must be an integer bigint.`);
}

function asNumber(value: unknown, fieldName: string) {
  const numberValue = typeof value === "bigint" ? Number(value) : value;

  if (
    typeof numberValue !== "number" ||
    !Number.isSafeInteger(numberValue) ||
    numberValue < 0
  ) {
    throw new TypeError(`${fieldName} must be a non-negative safe integer.`);
  }

  return numberValue;
}

function asBoolean(value: unknown, fieldName: string) {
  if (typeof value === "boolean") {
    return value;
  }

  throw new TypeError(`${fieldName} must be a boolean.`);
}

function asAddress(value: unknown, fieldName: string): Address {
  if (typeof value === "string" && isAddress(value)) {
    return getAddress(value);
  }

  throw new TypeError(`${fieldName} must be an EVM address.`);
}

function asBytes32(value: unknown, fieldName: string): ContractV1Bytes32 {
  if (
    typeof value === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(value)
  ) {
    return value as ContractV1Bytes32;
  }

  throw new TypeError(`${fieldName} must be bytes32.`);
}

function tupleField(value: unknown, key: string, index: number) {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Contract tuple result must be an object.");
  }

  const record = value as Record<string, unknown>;

  if (key in record) {
    return record[key];
  }

  if (Array.isArray(value)) {
    return value[index];
  }

  throw new TypeError(`Contract tuple result is missing ${key}.`);
}

export function normalizeContractV1CycleSnapshot(
  value: unknown
): ContractV1CycleSnapshot {
  return {
    exists: asBoolean(tupleField(value, "exists", 0), "exists"),
    configVersion: asBigInt(
      tupleField(value, "configVersion", 1),
      "configVersion"
    ),
    configHash: asBytes32(tupleField(value, "configHash", 2), "configHash"),
    startsAt: asBigInt(tupleField(value, "startsAt", 3), "startsAt"),
    openEndsAt: asBigInt(tupleField(value, "openEndsAt", 4), "openEndsAt"),
    playbackStartsAt: asBigInt(
      tupleField(value, "playbackStartsAt", 5),
      "playbackStartsAt"
    ),
    endsAt: asBigInt(tupleField(value, "endsAt", 6), "endsAt"),
    proofDeadlineEndsAt: asBigInt(
      tupleField(value, "proofDeadlineEndsAt", 7),
      "proofDeadlineEndsAt"
    ),
    slotCount: asNumber(tupleField(value, "slotCount", 8), "slotCount"),
    playbackSecondsPerSlot: asBigInt(
      tupleField(value, "playbackSecondsPerSlot", 9),
      "playbackSecondsPerSlot"
    ),
    minimumPaidBid: asBigInt(
      tupleField(value, "minimumPaidBid", 10),
      "minimumPaidBid"
    ),
    treasury: asAddress(tupleField(value, "treasury", 11), "treasury"),
  };
}

export function normalizeContractV1SiteConfig(
  value: unknown
): ContractV1SiteConfig {
  return {
    exists: asBoolean(tupleField(value, "exists", 0), "exists"),
    version: asBigInt(tupleField(value, "version", 1), "version"),
    effectiveCycleId: asBigInt(
      tupleField(value, "effectiveCycleId", 2),
      "effectiveCycleId"
    ),
    firstCycleStartsAt: asBigInt(
      tupleField(value, "firstCycleStartsAt", 3),
      "firstCycleStartsAt"
    ),
    openSeconds: asBigInt(tupleField(value, "openSeconds", 4), "openSeconds"),
    lockedSeconds: asBigInt(
      tupleField(value, "lockedSeconds", 5),
      "lockedSeconds"
    ),
    playbackSecondsPerSlot: asBigInt(
      tupleField(value, "playbackSecondsPerSlot", 6),
      "playbackSecondsPerSlot"
    ),
    proofDeadlineSeconds: asBigInt(
      tupleField(value, "proofDeadlineSeconds", 7),
      "proofDeadlineSeconds"
    ),
    slotCount: asNumber(tupleField(value, "slotCount", 8), "slotCount"),
    minimumPaidBid: asBigInt(
      tupleField(value, "minimumPaidBid", 9),
      "minimumPaidBid"
    ),
    treasury: asAddress(tupleField(value, "treasury", 10), "treasury"),
    configHash: asBytes32(tupleField(value, "configHash", 11), "configHash"),
  };
}

export function normalizeContractV1SlotState(
  value: unknown
): ContractV1SlotState {
  return {
    outcome: asNumber(tupleField(value, "outcome", 0), "outcome"),
    paidWinner: asAddress(tupleField(value, "paidWinner", 1), "paidWinner"),
    paidAmount: asBigInt(tupleField(value, "paidAmount", 2), "paidAmount"),
    advertisementId: asBytes32(
      tupleField(value, "advertisementId", 3),
      "advertisementId"
    ),
    reservationId: asBytes32(
      tupleField(value, "reservationId", 4),
      "reservationId"
    ),
    settlementId: asBytes32(
      tupleField(value, "settlementId", 5),
      "settlementId"
    ),
    playbackReportDigest: asBytes32(
      tupleField(value, "playbackReportDigest", 6),
      "playbackReportDigest"
    ),
  };
}

export async function readContractV1EngineStaticConfig({
  client = arcPublicClient,
  engineAddress,
}: {
  client?: ContractV1ReadClient;
  engineAddress: Address;
}): Promise<ContractV1EngineStaticConfig> {
  const escrowAddress = await client.readContract({
    address: engineAddress,
    abi: auctionEngineV1ReadAbi,
    functionName: "escrow",
  });

  return {
    escrowAddress: asAddress(escrowAddress, "AuctionEngineV1.escrow"),
  };
}

export async function readContractV1CurrentCycleId({
  client = arcPublicClient,
  engineAddress,
  siteId,
}: {
  client?: ContractV1ReadClient;
  engineAddress: Address;
  siteId: ContractV1Bytes32;
}) {
  const cycleId = await client.readContract({
    address: engineAddress,
    abi: auctionEngineV1ReadAbi,
    functionName: "currentCycleId",
    args: [siteId],
  });

  return asBigInt(cycleId, "AuctionEngineV1.currentCycleId");
}

export async function readContractV1CyclePreview({
  client = arcPublicClient,
  engineAddress,
  siteId,
  cycleId,
}: {
  client?: ContractV1ReadClient;
  engineAddress: Address;
  siteId: ContractV1Bytes32;
  cycleId: bigint;
}) {
  const snapshot = await client.readContract({
    address: engineAddress,
    abi: auctionEngineV1ReadAbi,
    functionName: "previewCycle",
    args: [siteId, cycleId],
  });

  return normalizeContractV1CycleSnapshot(snapshot);
}

export async function readContractV1CycleSnapshot({
  client = arcPublicClient,
  engineAddress,
  siteId,
  cycleId,
}: {
  client?: ContractV1ReadClient;
  engineAddress: Address;
  siteId: ContractV1Bytes32;
  cycleId: bigint;
}) {
  const snapshot = await client.readContract({
    address: engineAddress,
    abi: auctionEngineV1ReadAbi,
    functionName: "getCycleSnapshot",
    args: [siteId, cycleId],
  });

  return normalizeContractV1CycleSnapshot(snapshot);
}

export async function readContractV1SiteConfig({
  client = arcPublicClient,
  engineAddress,
  siteId,
  version,
}: {
  client?: ContractV1ReadClient;
  engineAddress: Address;
  siteId: ContractV1Bytes32;
  version: number;
}) {
  const siteConfig = await client.readContract({
    address: engineAddress,
    abi: auctionEngineV1ReadAbi,
    functionName: "getSiteConfig",
    args: [siteId, version],
  });

  return normalizeContractV1SiteConfig(siteConfig);
}

export async function readContractV1SiteConfigForCycle({
  client = arcPublicClient,
  engineAddress,
  siteId,
  cycleId,
}: {
  client?: ContractV1ReadClient;
  engineAddress: Address;
  siteId: ContractV1Bytes32;
  cycleId: bigint;
}) {
  const siteConfig = await client.readContract({
    address: engineAddress,
    abi: auctionEngineV1ReadAbi,
    functionName: "getSiteConfigForCycle",
    args: [siteId, cycleId],
  });

  return normalizeContractV1SiteConfig(siteConfig);
}

export async function readContractV1SlotDiagnostics({
  client = arcPublicClient,
  engineAddress,
  siteId,
  cycleId,
  slotCount,
}: {
  client?: ContractV1ReadClient;
  engineAddress: Address;
  siteId: ContractV1Bytes32;
  cycleId: bigint;
  slotCount: number;
}): Promise<ContractV1SlotDiagnostic[]> {
  const slots: ContractV1SlotDiagnostic[] = [];

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    const [slotState, bidCount] = await Promise.all([
      client.readContract({
        address: engineAddress,
        abi: auctionEngineV1ReadAbi,
        functionName: "getSlotState",
        args: [siteId, cycleId, slotIndex],
      }),
      client.readContract({
        address: engineAddress,
        abi: auctionEngineV1ReadAbi,
        functionName: "getSlotBidCount",
        args: [siteId, cycleId, slotIndex],
      }),
    ]);

    slots.push({
      slotIndex,
      state: normalizeContractV1SlotState(slotState),
      bidCount: asBigInt(bidCount, "AuctionEngineV1.getSlotBidCount"),
    });
  }

  return slots;
}
