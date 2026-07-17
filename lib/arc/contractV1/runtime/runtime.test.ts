import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { CONTRACT_V1_SITE_ID_TEST_VECTORS, getContractV1SiteId } from "../siteIds.ts";
import type { ContractV1AddressConfig } from "../config.ts";
import type { ContractV1Bytes32, ContractV1SlotState } from "../types.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { canDepositToV2Escrow, canOpenContractV1DepositFlow, canPlaceBid, canWithdraw } from "./eligibility.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { classifyContractV1ReadError, isContractV1SiteNotConfiguredError } from "./errors.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { resolveContractV1LocalSiteId, resolveContractV1SiteSupport, toContractV1RuntimeModeConfig } from "./mode.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { deriveContractV1Phase, type ContractV1PhaseSnapshot } from "./phase.ts";
import type { ContractV1PhaseState, ContractV1SiteSupport } from "./types.ts";

const ESCROW_ADDRESS = "0x00000000000000000000000000000000000000e1";
const ENGINE_ADDRESS = "0x00000000000000000000000000000000000000e2";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const ADVERTISEMENT_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000a11" as ContractV1Bytes32;
const NY_SITE_ID = CONTRACT_V1_SITE_ID_TEST_VECTORS[0].siteId;
const LA_SITE_KEY = "los-angeles/hollywood-boulevard";
const SUPPORTED_SITE = {
  supported: true,
  siteId: NY_SITE_ID,
} as const satisfies ContractV1SiteSupport;
const UNSUPPORTED_SITE = {
  supported: false,
  reason: "not_configured",
} as const satisfies ContractV1SiteSupport;
const OPEN_PHASE = {
  phase: "open",
  currentSlotIndex: null,
} as const satisfies ContractV1PhaseState;
const LOCKED_PHASE = {
  phase: "locked",
  currentSlotIndex: null,
} as const satisfies ContractV1PhaseState;
const UNFINALIZED_SLOT = slotState(0);
const FINALIZED_SLOT = slotState(1);

function phaseSnapshot(
  overrides: Partial<ContractV1PhaseSnapshot> = {}
): ContractV1PhaseSnapshot {
  return {
    startsAt: BigInt(100),
    openEndsAt: BigInt(160),
    playbackStartsAt: BigInt(162),
    endsAt: BigInt(192),
    slotCount: 3,
    playbackSecondsPerSlot: BigInt(10),
    ...overrides,
  };
}

function slotState(outcome: number): ContractV1SlotState {
  return {
    outcome,
    paidWinner: ZERO_ADDRESS,
    paidAmount: BigInt(0),
    advertisementId: ZERO_BYTES32,
    reservationId: ZERO_BYTES32,
    settlementId: ZERO_BYTES32,
    playbackReportDigest: ZERO_BYTES32,
  };
}

function addressConfig(
  overrides: Partial<ContractV1AddressConfig> = {}
): ContractV1AddressConfig {
  return {
    mode: "legacy",
    appModeRawValue: null,
    isContractMode: false,
    valid: true,
    escrowAddress: null,
    engineAddress: null,
    rawEscrowAddress: null,
    rawEngineAddress: null,
    warnings: [],
    errors: [],
    ...overrides,
  };
}

test("runtime mode defaults to legacy", () => {
  const config = toContractV1RuntimeModeConfig(addressConfig());

  assert.equal(config.mode, "legacy");
  assert.equal(config.isContractMode, false);
  assert.equal(config.valid, true);
});

test("runtime mode accepts explicit contract_v1", () => {
  const config = toContractV1RuntimeModeConfig(
    addressConfig({
      mode: "contract_v1",
      appModeRawValue: "contract_v1",
      isContractMode: true,
      escrowAddress: ESCROW_ADDRESS,
      engineAddress: ENGINE_ADDRESS,
    })
  );

  assert.equal(config.mode, "contract_v1");
  assert.equal(config.isContractMode, true);
  assert.equal(config.valid, true);
});

test("runtime mode unknown value is safe and does not enable Contract V1", () => {
  const config = toContractV1RuntimeModeConfig(
    addressConfig({
      mode: "legacy",
      appModeRawValue: "shadow",
      isContractMode: false,
      valid: false,
      errors: [
        {
          kind: "config",
          code: "contract_v1_unknown_app_mode",
          message: "Unknown mode.",
        },
      ],
    })
  );

  assert.equal(config.mode, "legacy");
  assert.equal(config.isContractMode, false);
  assert.equal(config.valid, false);
  assert.equal(config.errors[0]?.code, "contract_v1_unknown_app_mode");
});

test("runtime mode reports invalid V1 config without silent fallback", () => {
  const config = toContractV1RuntimeModeConfig(
    addressConfig({
      mode: "contract_v1",
      appModeRawValue: "contract_v1",
      isContractMode: true,
      valid: false,
      errors: [
        {
          kind: "config",
          code: "contract_v1_address_missing",
          message: "Missing escrow.",
        },
        {
          kind: "config",
          code: "contract_v1_address_missing",
          message: "Missing engine.",
        },
      ],
    })
  );

  assert.equal(config.mode, "contract_v1");
  assert.equal(config.valid, false);
  assert.deepEqual(
    config.errors.map((error) => error.code),
    ["contract_v1_address_missing", "contract_v1_address_missing"]
  );
});

test("site support resolves canonical NY mapping through configured read", async () => {
  const support = await resolveContractV1SiteSupport({
    siteKey: "new-york/times-square",
    resolveSiteId: getContractV1SiteId,
    isSiteNotConfiguredError: isContractV1SiteNotConfiguredError,
    readSiteConfig: async (siteId) => {
      assert.equal(siteId, NY_SITE_ID);
      return { exists: true };
    },
  });

  assert.deepEqual(support, SUPPORTED_SITE);
});

test("site support rejects invalid local site key before reads", async () => {
  let readCalled = false;
  const support = await resolveContractV1SiteSupport({
    siteKey: "New York / Times Square",
    resolveSiteId: getContractV1SiteId,
    isSiteNotConfiguredError: isContractV1SiteNotConfiguredError,
    readSiteConfig: async () => {
      readCalled = true;
      return { exists: true };
    },
  });

  assert.equal(readCalled, false);
  assert.deepEqual(support, {
    supported: false,
    reason: "invalid_site_key",
  });
});

test("site support classifies not configured separately from read failures", async () => {
  const fromEmptyConfig = await resolveContractV1SiteSupport({
    siteKey: "new-york/times-square",
    resolveSiteId: getContractV1SiteId,
    isSiteNotConfiguredError: isContractV1SiteNotConfiguredError,
    readSiteConfig: async () => ({ exists: false }),
  });
  const fromContractError = await resolveContractV1SiteSupport({
    siteKey: "new-york/times-square",
    resolveSiteId: getContractV1SiteId,
    isSiteNotConfiguredError: isContractV1SiteNotConfiguredError,
    readSiteConfig: async () => {
      throw new Error("SiteNotConfigured(bytes32)");
    },
  });
  const fromRpcError = await resolveContractV1SiteSupport({
    siteKey: "new-york/times-square",
    resolveSiteId: getContractV1SiteId,
    isSiteNotConfiguredError: isContractV1SiteNotConfiguredError,
    readSiteConfig: async () => {
      throw new Error("fetch failed");
    },
  });

  assert.deepEqual(fromEmptyConfig, {
    supported: false,
    reason: "not_configured",
  });
  assert.deepEqual(fromContractError, {
    supported: false,
    reason: "not_configured",
  });
  assert.deepEqual(fromRpcError, {
    supported: false,
    reason: "config_unavailable",
  });
});

test("SiteNotConfigured classifier prefers structured errors and supports nested causes", () => {
  assert.equal(
    isContractV1SiteNotConfiguredError({
      errorName: "SiteNotConfigured",
    }),
    true
  );
  assert.equal(
    isContractV1SiteNotConfiguredError({
      error: {
        name: "SiteNotConfigured",
      },
    }),
    true
  );
  assert.equal(
    isContractV1SiteNotConfiguredError(
      new Error("wrapper", {
        cause: {
          shortMessage: "execution reverted",
          errorName: "SiteNotConfigured",
        },
      })
    ),
    true
  );
  assert.equal(
    isContractV1SiteNotConfiguredError(new Error("fetch failed")),
    false
  );
  assert.equal(
    isContractV1SiteNotConfiguredError(
      new Error("site request failed because RPC timed out")
    ),
    false
  );
});

test("LA is not declared supported by local hardcode", async () => {
  const local = resolveContractV1LocalSiteId({
    siteKey: LA_SITE_KEY,
    resolveSiteId: getContractV1SiteId,
  });
  const liveSupport = await resolveContractV1SiteSupport({
    siteKey: LA_SITE_KEY,
    resolveSiteId: getContractV1SiteId,
    isSiteNotConfiguredError: isContractV1SiteNotConfiguredError,
    readSiteConfig: async () => ({ exists: false }),
  });

  assert.equal(local.supported, true);
  assert.deepEqual(liveSupport, {
    supported: false,
    reason: "not_configured",
  });
});

test("phase derivation uses exact contract timestamp boundaries", () => {
  const snapshot = phaseSnapshot();

  assert.deepEqual(deriveContractV1Phase(snapshot, BigInt(99)), {
    phase: "not_started",
    currentSlotIndex: null,
  });
  assert.deepEqual(deriveContractV1Phase(snapshot, BigInt(100)), {
    phase: "open",
    currentSlotIndex: null,
  });
  assert.deepEqual(deriveContractV1Phase(snapshot, BigInt(159)), {
    phase: "open",
    currentSlotIndex: null,
  });
  assert.deepEqual(deriveContractV1Phase(snapshot, BigInt(160)), {
    phase: "locked",
    currentSlotIndex: null,
  });
  assert.deepEqual(deriveContractV1Phase(snapshot, BigInt(161)), {
    phase: "locked",
    currentSlotIndex: null,
  });
  assert.deepEqual(deriveContractV1Phase(snapshot, BigInt(162)), {
    phase: "live",
    currentSlotIndex: 0,
  });
  assert.deepEqual(deriveContractV1Phase(snapshot, BigInt(171)), {
    phase: "live",
    currentSlotIndex: 0,
  });
  assert.deepEqual(deriveContractV1Phase(snapshot, BigInt(172)), {
    phase: "live",
    currentSlotIndex: 1,
  });
  assert.deepEqual(deriveContractV1Phase(snapshot, BigInt(181)), {
    phase: "live",
    currentSlotIndex: 1,
  });
  assert.deepEqual(deriveContractV1Phase(snapshot, BigInt(182)), {
    phase: "live",
    currentSlotIndex: 2,
  });
  assert.deepEqual(deriveContractV1Phase(snapshot, BigInt(191)), {
    phase: "live",
    currentSlotIndex: 2,
  });
  assert.deepEqual(deriveContractV1Phase(snapshot, BigInt(192)), {
    phase: "ended",
    currentSlotIndex: null,
  });
});

test("phase derivation preserves bigint timestamps and rejects invalid snapshots", () => {
  const bigStart = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(10);
  const bigSnapshot = phaseSnapshot({
    startsAt: bigStart,
    openEndsAt: bigStart + BigInt(60),
    playbackStartsAt: bigStart + BigInt(62),
    endsAt: bigStart + BigInt(92),
  });

  assert.deepEqual(deriveContractV1Phase(bigSnapshot, bigStart + BigInt(62)), {
    phase: "live",
    currentSlotIndex: 0,
  });
  assert.equal(deriveContractV1Phase(null, BigInt(100)), null);
  assert.equal(
    deriveContractV1Phase(
      { ...phaseSnapshot(), playbackSecondsPerSlot: BigInt(0) },
      BigInt(100)
    ),
    null
  );
  assert.equal(
    deriveContractV1Phase(
      { ...phaseSnapshot(), endsAt: BigInt(191) },
      BigInt(100)
    ),
    null
  );
});

test("V2 escrow deposit eligibility is site-independent", () => {
  assert.deepEqual(
    canDepositToV2Escrow({
      mode: "contract_v1",
      configValid: true,
      chainMatched: true,
      walletConnected: true,
      amount: BigInt(1),
    }),
    { allowed: true, code: "allowed" }
  );
  assert.equal(
    canDepositToV2Escrow({
      mode: "contract_v1",
      configValid: true,
      chainMatched: true,
      walletConnected: true,
      amount: BigInt(0),
    }).code,
    "invalid_amount"
  );
  assert.equal(
    canDepositToV2Escrow({
      mode: "contract_v1",
      configValid: true,
      chainMatched: true,
      walletConnected: true,
      amount: -BigInt(1),
    }).code,
    "invalid_amount"
  );
  assert.equal(
    canDepositToV2Escrow({
      mode: "legacy",
      configValid: true,
      chainMatched: true,
      walletConnected: true,
      amount: BigInt(1),
    }).code,
    "wrong_mode"
  );
  assert.equal(
    canDepositToV2Escrow({
      mode: "contract_v1",
      configValid: true,
      chainMatched: false,
      walletConnected: true,
      amount: BigInt(1),
    }).code,
    "wrong_chain"
  );
  assert.equal(
    canDepositToV2Escrow({
      mode: "contract_v1",
      configValid: true,
      chainMatched: true,
      walletConnected: false,
      amount: BigInt(1),
    }).code,
    "wallet_disconnected"
  );
});

test("Contract V1 deposit flow can apply product site readiness gate", () => {
  assert.deepEqual(
    canOpenContractV1DepositFlow({
      mode: "contract_v1",
      configValid: true,
      siteSupport: SUPPORTED_SITE,
      chainMatched: true,
      walletConnected: true,
      amount: BigInt(1),
    }),
    { allowed: true, code: "allowed" }
  );
  assert.equal(
    canOpenContractV1DepositFlow({
      mode: "contract_v1",
      configValid: true,
      siteSupport: UNSUPPORTED_SITE,
      chainMatched: true,
      walletConnected: true,
      amount: BigInt(1),
    }).code,
    "unsupported_site"
  );
});

test("withdraw eligibility uses V2 available balance without site dependency", () => {
  assert.deepEqual(
    canWithdraw({
      mode: "contract_v1",
      configValid: true,
      chainMatched: true,
      walletConnected: true,
      amount: BigInt(70),
      available: BigInt(70),
    }),
    { allowed: true, code: "allowed" }
  );
  assert.equal(
    canWithdraw({
      mode: "contract_v1",
      configValid: true,
      chainMatched: true,
      walletConnected: true,
      amount: BigInt(0),
      available: BigInt(70),
    }).code,
    "invalid_amount"
  );
  assert.equal(
    canWithdraw({
      mode: "contract_v1",
      configValid: true,
      chainMatched: true,
      walletConnected: true,
      amount: BigInt(80),
      available: BigInt(70),
    }).code,
    "insufficient_available_balance"
  );
});

test("bid eligibility allows open bids below the Demo Bot floor and blocks unsafe cases", () => {
  assert.deepEqual(
    canPlaceBid({
      mode: "contract_v1",
      configValid: true,
      siteSupport: SUPPORTED_SITE,
      chainMatched: true,
      walletConnected: true,
      phase: OPEN_PHASE,
      slotState: UNFINALIZED_SLOT,
      advertisementId: ADVERTISEMENT_ID,
      amount: BigInt(1),
      available: BigInt(10),
    }),
    { allowed: true, code: "allowed" }
  );
  assert.equal(
    canPlaceBid({
      mode: "contract_v1",
      configValid: true,
      siteSupport: SUPPORTED_SITE,
      chainMatched: true,
      walletConnected: true,
      phase: LOCKED_PHASE,
      slotState: UNFINALIZED_SLOT,
      advertisementId: ADVERTISEMENT_ID,
      amount: BigInt(1),
      available: BigInt(10),
    }).code,
    "not_open"
  );
  assert.equal(
    canPlaceBid({
      mode: "contract_v1",
      configValid: true,
      siteSupport: SUPPORTED_SITE,
      chainMatched: true,
      walletConnected: true,
      phase: OPEN_PHASE,
      slotState: FINALIZED_SLOT,
      advertisementId: ADVERTISEMENT_ID,
      amount: BigInt(1),
      available: BigInt(10),
    }).code,
    "slot_finalized"
  );
  assert.equal(
    canPlaceBid({
      mode: "contract_v1",
      configValid: true,
      siteSupport: SUPPORTED_SITE,
      chainMatched: true,
      walletConnected: true,
      phase: OPEN_PHASE,
      slotState: UNFINALIZED_SLOT,
      advertisementId: ZERO_BYTES32,
      amount: BigInt(1),
      available: BigInt(10),
    }).code,
    "missing_advertisement"
  );
  assert.equal(
    canPlaceBid({
      mode: "contract_v1",
      configValid: true,
      siteSupport: SUPPORTED_SITE,
      chainMatched: true,
      walletConnected: true,
      phase: OPEN_PHASE,
      slotState: UNFINALIZED_SLOT,
      advertisementId: ADVERTISEMENT_ID,
      amount: BigInt(0),
      available: BigInt(10),
    }).code,
    "invalid_amount"
  );
  assert.equal(
    canPlaceBid({
      mode: "contract_v1",
      configValid: true,
      siteSupport: SUPPORTED_SITE,
      chainMatched: true,
      walletConnected: true,
      phase: OPEN_PHASE,
      slotState: UNFINALIZED_SLOT,
      advertisementId: ADVERTISEMENT_ID,
      amount: BigInt(11),
      available: BigInt(10),
    }).code,
    "insufficient_available_balance"
  );
  assert.equal(
    canPlaceBid({
      mode: "contract_v1",
      configValid: true,
      siteSupport: UNSUPPORTED_SITE,
      chainMatched: true,
      walletConnected: true,
      phase: OPEN_PHASE,
      slotState: UNFINALIZED_SLOT,
      advertisementId: ADVERTISEMENT_ID,
      amount: BigInt(1),
      available: BigInt(10),
    }).code,
    "unsupported_site"
  );
});

test("read error classifier keeps RPC failures separate from contract read failures", () => {
  assert.equal(classifyContractV1ReadError(new Error("timeout")).kind, "rpc_unavailable");
  assert.equal(
    classifyContractV1ReadError(new Error("execution reverted")).kind,
    "contract_read_failed"
  );
});

test("runtime modules have no storage, React, direct RPC, or Redis side effects", () => {
  const runtimeDirectory = new URL("./", import.meta.url);
  const forbidden = [
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /from\s+["']react["']/,
    /\breadContract\b/,
    /\bRedis\b|\bredis\b/,
    /\bfetch\s*\(/,
  ];

  for (const entry of readdirSync(runtimeDirectory)) {
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) {
      continue;
    }

    const source = readFileSync(new URL(entry, runtimeDirectory), "utf8");

    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${entry} matched ${pattern}`);
    }
  }
});
