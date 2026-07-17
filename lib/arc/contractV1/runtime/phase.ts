import type { ContractV1CycleSnapshot } from "../types";
import type { ContractV1PhaseState } from "./types";

export type ContractV1PhaseSnapshot = Pick<
  ContractV1CycleSnapshot,
  | "startsAt"
  | "openEndsAt"
  | "playbackStartsAt"
  | "endsAt"
  | "slotCount"
  | "playbackSecondsPerSlot"
>;

export function deriveContractV1Phase(
  snapshot: ContractV1PhaseSnapshot | null | undefined,
  chainTimestamp: bigint
): ContractV1PhaseState | null {
  if (!isUsablePhaseSnapshot(snapshot)) {
    return null;
  }

  if (chainTimestamp < snapshot.startsAt) {
    return {
      phase: "not_started",
      currentSlotIndex: null,
    };
  }

  if (chainTimestamp < snapshot.openEndsAt) {
    return {
      phase: "open",
      currentSlotIndex: null,
    };
  }

  if (chainTimestamp < snapshot.playbackStartsAt) {
    return {
      phase: "locked",
      currentSlotIndex: null,
    };
  }

  if (chainTimestamp >= snapshot.endsAt) {
    return {
      phase: "ended",
      currentSlotIndex: null,
    };
  }

  const slotIndex =
    (chainTimestamp - snapshot.playbackStartsAt) /
    snapshot.playbackSecondsPerSlot;

  if (slotIndex < BigInt(0) || slotIndex >= BigInt(snapshot.slotCount)) {
    return {
      phase: "ended",
      currentSlotIndex: null,
    };
  }

  if (slotIndex > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return {
    phase: "live",
    currentSlotIndex: Number(slotIndex),
  };
}

function isUsablePhaseSnapshot(
  snapshot: ContractV1PhaseSnapshot | null | undefined
): snapshot is ContractV1PhaseSnapshot {
  if (typeof snapshot !== "object" || snapshot === null) {
    return false;
  }

  const hasBigIntTimestamps =
    typeof snapshot.startsAt === "bigint" &&
    typeof snapshot.openEndsAt === "bigint" &&
    typeof snapshot.playbackStartsAt === "bigint" &&
    typeof snapshot.endsAt === "bigint" &&
    typeof snapshot.playbackSecondsPerSlot === "bigint";

  if (!hasBigIntTimestamps) {
    return false;
  }

  if (
    !Number.isSafeInteger(snapshot.slotCount) ||
    snapshot.slotCount <= 0 ||
    snapshot.playbackSecondsPerSlot <= BigInt(0)
  ) {
    return false;
  }

  if (
    snapshot.startsAt > snapshot.openEndsAt ||
    snapshot.openEndsAt > snapshot.playbackStartsAt ||
    snapshot.playbackStartsAt > snapshot.endsAt
  ) {
    return false;
  }

  const calculatedEndsAt =
    snapshot.playbackStartsAt +
    BigInt(snapshot.slotCount) * snapshot.playbackSecondsPerSlot;

  return calculatedEndsAt === snapshot.endsAt;
}
