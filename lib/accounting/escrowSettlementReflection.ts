import type { UsdcMinorUnits } from "@/lib/money/usdc";

type EscrowCycleBaseline = {
  cycleId: number;
  advertiserAddress: `0x${string}`;
  balance: UsdcMinorUnits;
};

type SyncEscrowCycleBaselineParams = {
  cycleId: number;
  advertiserAddress: `0x${string}`;
  escrowBalance: UsdcMinorUnits;
};

type GetReflectedSettledAmountParams = {
  cycleId: number;
  advertiserAddress: `0x${string}` | null;
  escrowBalance: UsdcMinorUnits | null;
};

const baselines = new Map<string, EscrowCycleBaseline>();
const listeners = new Set<() => void>();
let version = 0;
const ESCROW_REFLECTION_BASELINE_KEY_PREFIX =
  "pdooh-accounting-escrow-reflection:";

function getBaselineKey(cycleId: number, advertiserAddress: `0x${string}`) {
  return `${cycleId}:${advertiserAddress.toLowerCase()}`;
}

function getStorageKey(cycleId: number, advertiserAddress: `0x${string}`) {
  return `${ESCROW_REFLECTION_BASELINE_KEY_PREFIX}${getBaselineKey(
    cycleId,
    advertiserAddress
  )}`;
}

function readStoredBaseline(
  cycleId: number,
  advertiserAddress: `0x${string}`
): EscrowCycleBaseline | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(
    getStorageKey(cycleId, advertiserAddress)
  );

  if (value === null) {
    return null;
  }

  try {
    const storedBaseline = JSON.parse(value) as EscrowCycleBaseline;

    if (
      storedBaseline.cycleId !== cycleId ||
      storedBaseline.advertiserAddress.toLowerCase() !==
        advertiserAddress.toLowerCase() ||
      !Number.isSafeInteger(storedBaseline.balance) ||
      storedBaseline.balance < 0
    ) {
      return null;
    }

    return storedBaseline;
  } catch {
    return null;
  }
}

function writeStoredBaseline(baseline: EscrowCycleBaseline) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getStorageKey(baseline.cycleId, baseline.advertiserAddress),
    JSON.stringify(baseline)
  );
}

function emitChange() {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeToEscrowSettlementReflection(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getEscrowSettlementReflectionSnapshot() {
  return version;
}

export function syncEscrowCycleBaseline({
  cycleId,
  advertiserAddress,
  escrowBalance,
}: SyncEscrowCycleBaselineParams) {
  const key = getBaselineKey(cycleId, advertiserAddress);
  const currentBaseline =
    baselines.get(key) ?? readStoredBaseline(cycleId, advertiserAddress);

  if (!currentBaseline) {
    const baseline = {
      cycleId,
      advertiserAddress,
      balance: escrowBalance,
    };

    baselines.set(key, baseline);
    writeStoredBaseline(baseline);
    emitChange();
    return;
  }

  const nextBalance = Math.max(currentBaseline.balance, escrowBalance);

  if (nextBalance !== currentBaseline.balance) {
    const baseline = {
      ...currentBaseline,
      balance: nextBalance,
    };

    baselines.set(key, baseline);
    writeStoredBaseline(baseline);
    emitChange();
  }
}

export function getReflectedSettledAmount({
  cycleId,
  advertiserAddress,
  escrowBalance,
}: GetReflectedSettledAmountParams): UsdcMinorUnits {
  if (!advertiserAddress || escrowBalance === null) {
    return 0;
  }

  const key = getBaselineKey(cycleId, advertiserAddress);
  const baseline =
    baselines.get(key) ?? readStoredBaseline(cycleId, advertiserAddress);

  if (!baseline) {
    return 0;
  }

  baselines.set(key, baseline);

  return Math.max(baseline.balance - escrowBalance, 0);
}
