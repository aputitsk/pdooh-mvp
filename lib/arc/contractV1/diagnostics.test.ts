import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { ARC_USDC_CONTRACT_ADDRESS } from "../arcConstants.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { CONTRACT_V1_APP_MODE_ENV_NAME } from "./appMode.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { CONTRACT_V1_ENGINE_ADDRESS_ENV_NAME, CONTRACT_V1_ESCROW_ADDRESS_ENV_NAME } from "./config.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { getContractV1Diagnostics } from "./diagnostics.ts";

const ESCROW_ADDRESS = "0x00000000000000000000000000000000000000e1";
const ENGINE_ADDRESS = "0x00000000000000000000000000000000000000e2";
const WALLET_ADDRESS = "0x00000000000000000000000000000000000000a1";
const OTHER_ADDRESS = "0x00000000000000000000000000000000000000d1";
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const ADVERTISEMENT_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000a11";
const CONFIG_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000c01";
type DiagnosticsReadClient = NonNullable<
  Parameters<typeof getContractV1Diagnostics>[0]["client"]
>;
type FakeReadRequest = {
  functionName: string;
  args?: readonly unknown[];
};
type FakeReadOverrides = {
  escrowEngineAddress?: string;
  usdcAddress?: string;
  engineEscrowAddress?: string;
  currentCycleError?: unknown;
  previewCycle?: Record<string, unknown>;
  persistedCycleSnapshot?: Record<string, unknown>;
  siteConfig?: Record<string, unknown>;
  balance?: bigint;
  available?: bigint;
  reserved?: bigint;
};

const contractModeEnv = {
  [CONTRACT_V1_APP_MODE_ENV_NAME]: "contract_v1",
  [CONTRACT_V1_ESCROW_ADDRESS_ENV_NAME]: ESCROW_ADDRESS,
  [CONTRACT_V1_ENGINE_ADDRESS_ENV_NAME]: ENGINE_ADDRESS,
};

function cycleSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    exists: false,
    configVersion: BigInt(1),
    configHash: CONFIG_HASH,
    startsAt: BigInt(100),
    openEndsAt: BigInt(160),
    playbackStartsAt: BigInt(162),
    endsAt: BigInt(182),
    proofDeadlineEndsAt: BigInt(242),
    slotCount: BigInt(2),
    playbackSecondsPerSlot: BigInt(10),
    minimumPaidBid: BigInt(20_000),
    treasury: OTHER_ADDRESS,
    ...overrides,
  };
}

function siteConfig(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    version: BigInt(1),
    effectiveCycleId: BigInt(0),
    firstCycleStartsAt: BigInt(100),
    openSeconds: BigInt(60),
    lockedSeconds: BigInt(2),
    playbackSecondsPerSlot: BigInt(10),
    proofDeadlineSeconds: BigInt(60),
    slotCount: BigInt(2),
    minimumPaidBid: BigInt(20_000),
    treasury: OTHER_ADDRESS,
    configHash: CONFIG_HASH,
    ...overrides,
  };
}

function slotState(slotIndex: unknown) {
  const numericSlotIndex = Number(slotIndex);

  return {
    outcome: numericSlotIndex === 0 ? BigInt(1) : BigInt(0),
    paidWinner: numericSlotIndex === 0 ? WALLET_ADDRESS : OTHER_ADDRESS,
    paidAmount:
      numericSlotIndex === 0 ? BigInt("1000000000000") : BigInt(0),
    advertisementId: numericSlotIndex === 0 ? ADVERTISEMENT_ID : ZERO_BYTES32,
    reservationId: ZERO_BYTES32,
    settlementId: ZERO_BYTES32,
    playbackReportDigest: ZERO_BYTES32,
  };
}

function createReadClient(overrides: FakeReadOverrides = {}) {
  const calls: FakeReadRequest[] = [];
  const client = {
    async readContract(request: FakeReadRequest) {
      calls.push(request);

      if (request.functionName === "engine") {
        return overrides.escrowEngineAddress ?? ENGINE_ADDRESS;
      }

      if (request.functionName === "usdc") {
        return overrides.usdcAddress ?? ARC_USDC_CONTRACT_ADDRESS;
      }

      if (request.functionName === "escrow") {
        return overrides.engineEscrowAddress ?? ESCROW_ADDRESS;
      }

      if (request.functionName === "currentCycleId") {
        if (overrides.currentCycleError) {
          throw overrides.currentCycleError;
        }

        return BigInt(7);
      }

      if (request.functionName === "previewCycle") {
        return cycleSnapshot(overrides.previewCycle ?? {});
      }

      if (request.functionName === "getCycleSnapshot") {
        return cycleSnapshot(overrides.persistedCycleSnapshot ?? {});
      }

      if (request.functionName === "getSiteConfigForCycle") {
        return siteConfig(overrides.siteConfig ?? {});
      }

      if (request.functionName === "getSlotState") {
        return slotState(request.args?.[2]);
      }

      if (request.functionName === "getSlotBidCount") {
        return BigInt(Number(request.args?.[2] ?? 0) + 1);
      }

      if (request.functionName === "balanceOf") {
        return overrides.balance ?? BigInt(10);
      }

      if (request.functionName === "availableOf") {
        return overrides.available ?? BigInt(7);
      }

      if (request.functionName === "reservedOf") {
        return overrides.reserved ?? BigInt(3);
      }

      throw new Error(`Unexpected read ${request.functionName}`);
    },
  };

  return {
    client: client as unknown as DiagnosticsReadClient,
    calls,
  };
}

test("legacy diagnostics do not read contracts or require V1 addresses", async () => {
  const { client, calls } = createReadClient();
  const diagnostics = await getContractV1Diagnostics({
    walletAddress: WALLET_ADDRESS,
    siteKey: "new-york/times-square",
    env: {},
    client,
  });

  assert.equal(diagnostics.appMode, "legacy");
  assert.equal(diagnostics.errors.length, 0);
  assert.equal(calls.length, 0);
});

test("missing contract_v1 addresses stop diagnostics before contract reads", async () => {
  const { client, calls } = createReadClient();
  const diagnostics = await getContractV1Diagnostics({
    walletAddress: WALLET_ADDRESS,
    siteKey: "new-york/times-square",
    env: { [CONTRACT_V1_APP_MODE_ENV_NAME]: "contract_v1" },
    client,
  });

  assert.equal(diagnostics.v1ConfigValid, false);
  assert.equal(calls.length, 0);
  assert.deepEqual(
    diagnostics.errors.map((error) => error.code),
    ["contract_v1_address_missing", "contract_v1_address_missing"]
  );
});

test("contract_v1 diagnostics preserve bigint values and iterate slots from chain config", async () => {
  const { client, calls } = createReadClient();
  const diagnostics = await getContractV1Diagnostics({
    walletAddress: WALLET_ADDRESS,
    siteKey: "new-york/times-square",
    env: contractModeEnv,
    client,
  });

  assert.equal(diagnostics.currentCycleId, BigInt(7));
  assert.equal(diagnostics.walletEscrow?.balance, BigInt(10));
  assert.equal(diagnostics.walletEscrow?.available, BigInt(7));
  assert.equal(diagnostics.walletEscrow?.reserved, BigInt(3));
  assert.equal(typeof diagnostics.slots[0]?.state.paidAmount, "bigint");
  assert.equal(diagnostics.slots[0]?.bidCount, BigInt(1));
  assert.equal(diagnostics.invariants[0]?.ok, true);
  assert.equal(
    diagnostics.warnings.some(
      (warning) => warning.code === "contract_v1_cycle_snapshot_missing"
    ),
    true
  );

  const slotStateCalls = calls.filter(
    (call) => call.functionName === "getSlotState"
  );
  const writeFunctionCalls = calls.filter((call) =>
    [
      "approve",
      "deposit",
      "withdraw",
      "placeBid",
      "snapshotCycle",
      "finalizeSlot",
      "confirmPlayback",
      "expireSlot",
      "settleSlot",
    ].includes(call.functionName)
  );

  assert.equal(slotStateCalls.length, 2);
  assert.deepEqual(
    slotStateCalls.map((call) => call.args?.[2]),
    [0, 1]
  );
  assert.equal(writeFunctionCalls.length, 0);
});

test("contract_v1 diagnostics reports escrow engine mismatch", async () => {
  const { client } = createReadClient({
    escrowEngineAddress: OTHER_ADDRESS,
  });
  const diagnostics = await getContractV1Diagnostics({
    walletAddress: WALLET_ADDRESS,
    siteKey: "new-york/times-square",
    env: contractModeEnv,
    client,
  });

  assert.equal(
    diagnostics.errors.some(
      (error) => error.code === "contract_v1_escrow_engine_mismatch"
    ),
    true
  );
});

test("contract_v1 diagnostics reports escrow accounting invariant failure", async () => {
  const { client } = createReadClient({
    balance: BigInt(10),
    available: BigInt(6),
    reserved: BigInt(3),
  });
  const diagnostics = await getContractV1Diagnostics({
    walletAddress: WALLET_ADDRESS,
    siteKey: "new-york/times-square",
    env: contractModeEnv,
    client,
  });

  assert.equal(diagnostics.invariants[0]?.ok, false);
  assert.equal(
    diagnostics.errors.some(
      (error) =>
        error.code === "contract_v1_escrow_balance_conservation_failed"
    ),
    true
  );
});

test("contract_v1 diagnostics maps read failures without falling back to writes", async () => {
  const { client, calls } = createReadClient({
    currentCycleError: new Error("RPC Request failed: rate limit"),
  });
  const diagnostics = await getContractV1Diagnostics({
    walletAddress: WALLET_ADDRESS,
    siteKey: "new-york/times-square",
    cycleId: BigInt(7),
    env: contractModeEnv,
    client,
  });

  assert.equal(
    diagnostics.errors.some(
      (error) => error.code === "contract_v1_rpc_rate_limited"
    ),
    true
  );
  assert.equal(
    calls.some((call) => call.functionName === "placeBid"),
    false
  );
});
