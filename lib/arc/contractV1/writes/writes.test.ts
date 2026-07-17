import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import type { Address, Hash } from "viem";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { depositToContractV1Escrow } from "./escrowDeposit.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { withdrawFromContractV1Escrow } from "./escrowWithdraw.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { classifyContractV1WriteError } from "./errors.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { ensureContractV1UsdcApproval } from "./usdcApproval.ts";
import type {
  ContractV1EscrowPostState,
  ContractV1ReadContractClient,
  ContractV1ReceiptClient,
  ContractV1WalletWriteClient,
  ContractV1WalletWriteContext,
} from "./types.ts";

const ACCOUNT = "0x00000000000000000000000000000000000000a1" as Address;
const USDC = "0x3600000000000000000000000000000000000000" as Address;
const ESCROW = "0x00000000000000000000000000000000000000e1" as Address;
const OTHER = "0x00000000000000000000000000000000000000b2" as Address;

type WriteRequest = Parameters<ContractV1WalletWriteClient["writeContract"]>[0];
type ReadRequest = Parameters<ContractV1ReadContractClient["readContract"]>[0];
type ReceiptStatus = "success" | "reverted";

type FakeClientOptions = {
  allowanceReads?: bigint[];
  walletUsdcBalance?: bigint;
  availableReads?: bigint[];
  postState?: ContractV1EscrowPostState;
  writeFailures?: Partial<Record<string, unknown>>;
  receiptStatuses?: ReceiptStatus[];
  receiptThrows?: boolean;
};

function createFakeClients(options: FakeClientOptions = {}) {
  const writes: WriteRequest[] = [];
  const reads: ReadRequest[] = [];
  const allowanceReads = [...(options.allowanceReads ?? [BigInt(0)])];
  const availableReads = [...(options.availableReads ?? [])];
  const receiptStatuses = [...(options.receiptStatuses ?? ["success"])];
  const postState = options.postState ?? {
    balance: BigInt(100),
    available: BigInt(70),
    reserved: BigInt(30),
  };
  let hashCounter = 1;

  const readClient: ContractV1ReadContractClient = {
    async readContract(request) {
      reads.push(request);

      if (request.functionName === "allowance") {
        return shiftOrLast(allowanceReads);
      }

      if (request.functionName === "balanceOf" && request.address === USDC) {
        return options.walletUsdcBalance ?? BigInt(100);
      }

      if (request.functionName === "balanceOf") {
        return postState.balance;
      }

      if (request.functionName === "availableOf") {
        return availableReads.length > 0
          ? shiftOrLast(availableReads)
          : postState.available;
      }

      if (request.functionName === "reservedOf") {
        return postState.reserved;
      }

      throw new Error(`Unexpected read ${request.functionName}`);
    },
  };
  const walletClient: ContractV1WalletWriteClient = {
    async writeContract(request) {
      writes.push(request);

      const failure = options.writeFailures?.[request.functionName];

      if (failure) {
        throw failure;
      }

      const hash = `0x${hashCounter.toString(16).padStart(64, "0")}` as Hash;
      hashCounter += 1;

      return hash;
    },
  };
  const receiptClient: ContractV1ReceiptClient = {
    async waitForTransactionReceipt() {
      if (options.receiptThrows) {
        throw new Error("receipt timeout");
      }

      return {
        status: receiptStatuses.shift() ?? "success",
      };
    },
  };

  return {
    readClient,
    walletClient,
    receiptClient,
    reads,
    writes,
  };
}

function context(
  overrides: Partial<ContractV1WalletWriteContext> = {}
): ContractV1WalletWriteContext {
  return {
    mode: "contract_v1",
    configValid: true,
    chainId: 5_042_002,
    expectedChainId: 5_042_002,
    account: ACCOUNT,
    escrowAddress: ESCROW,
    usdcAddress: USDC,
    ...overrides,
  };
}

function shiftOrLast(values: bigint[]) {
  if (values.length <= 1) {
    return values[0] ?? BigInt(0);
  }

  return values.shift() ?? BigInt(0);
}

test("approval skips approve when allowance is already sufficient", async () => {
  const clients = createFakeClients({ allowanceReads: [BigInt(50)] });
  const result = await ensureContractV1UsdcApproval({
    ...clients,
    account: ACCOUNT,
    usdcAddress: USDC,
    spender: ESCROW,
    amount: BigInt(25),
  });

  assert.equal(result.ok, true);
  assert.equal(clients.writes.length, 0);
  assert.equal(result.ok && result.value.approvalTransactionHash, undefined);
});

test("approval sends exact amount to the configured V2 escrow spender", async () => {
  const clients = createFakeClients({
    allowanceReads: [BigInt(0), BigInt(123)],
  });
  const result = await ensureContractV1UsdcApproval({
    ...clients,
    account: ACCOUNT,
    usdcAddress: USDC,
    spender: ESCROW,
    amount: BigInt(123),
  });

  assert.equal(result.ok, true);
  assert.equal(clients.writes.length, 1);
  assert.equal(clients.writes[0].address, USDC);
  assert.equal(clients.writes[0].functionName, "approve");
  assert.deepEqual(clients.writes[0].args, [ESCROW, BigInt(123)]);
  assert.notDeepEqual(clients.writes[0].args, [OTHER, BigInt(123)]);
});

test("approval maps user rejection and reverted receipts", async () => {
  const rejected = await ensureContractV1UsdcApproval({
    ...createFakeClients({
      allowanceReads: [BigInt(0)],
      writeFailures: {
        approve: { code: 4001, message: "user rejected request" },
      },
    }),
    account: ACCOUNT,
    usdcAddress: USDC,
    spender: ESCROW,
    amount: BigInt(1),
  });
  const reverted = await ensureContractV1UsdcApproval({
    ...createFakeClients({
      allowanceReads: [BigInt(0)],
      receiptStatuses: ["reverted"],
    }),
    account: ACCOUNT,
    usdcAddress: USDC,
    spender: ESCROW,
    amount: BigInt(1),
  });

  assert.equal(rejected.ok, false);
  assert.equal(!rejected.ok && rejected.error.code, "transaction_rejected");
  assert.equal(reverted.ok, false);
  assert.equal(!reverted.ok && reverted.error.code, "transaction_reverted");
});

test("deposit succeeds with approve then deposit and returns post-state", async () => {
  const clients = createFakeClients({
    allowanceReads: [BigInt(0), BigInt(25)],
    postState: {
      balance: BigInt(25),
      available: BigInt(25),
      reserved: BigInt(0),
    },
  });
  const result = await depositToContractV1Escrow({
    context: context(),
    ...clients,
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(25),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    clients.writes.map((write) => write.functionName),
    ["approve", "deposit"]
  );
  assert.equal(result.ok && result.value.approvalTransactionHash !== undefined, true);
  assert.equal(result.ok && result.value.postState.available, BigInt(25));
});

test("deposit succeeds without approve when allowance is sufficient", async () => {
  const clients = createFakeClients({
    allowanceReads: [BigInt(25)],
    postState: {
      balance: BigInt(25),
      available: BigInt(25),
      reserved: BigInt(0),
    },
  });
  const result = await depositToContractV1Escrow({
    context: context(),
    ...clients,
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(25),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    clients.writes.map((write) => write.functionName),
    ["deposit"]
  );
  assert.equal(result.ok && result.value.approvalTransactionHash, undefined);
});

test("deposit preflight blocks invalid amount, mode, chain, wallet, config, and wallet balance", async () => {
  const validClients = createFakeClients();
  const invalidAmount = await depositToContractV1Escrow({
    context: context(),
    ...validClients,
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(0),
  });
  const wrongMode = await depositToContractV1Escrow({
    context: context({ mode: "legacy" }),
    ...validClients,
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(1),
  });
  const wrongChain = await depositToContractV1Escrow({
    context: context({ chainId: 1 }),
    ...validClients,
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(1),
  });
  const disconnected = await depositToContractV1Escrow({
    context: context({ account: null }),
    ...validClients,
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(1),
  });
  const invalidConfig = await depositToContractV1Escrow({
    context: context({ configValid: false }),
    ...validClients,
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(1),
  });
  const insufficientWallet = await depositToContractV1Escrow({
    context: context(),
    ...createFakeClients({ walletUsdcBalance: BigInt(1) }),
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(2),
  });

  assert.equal(!invalidAmount.ok && invalidAmount.error.code, "invalid_amount");
  assert.equal(!wrongMode.ok && wrongMode.error.code, "invalid_config");
  assert.equal(!wrongChain.ok && wrongChain.error.code, "wrong_chain");
  assert.equal(!disconnected.ok && disconnected.error.code, "wallet_disconnected");
  assert.equal(!invalidConfig.ok && invalidConfig.error.code, "invalid_config");
  assert.equal(
    !insufficientWallet.ok && insufficientWallet.error.code,
    "insufficient_wallet_usdc"
  );
});

test("deposit handles receipt uncertainty and post-state invariant failure", async () => {
  const uncertain = await depositToContractV1Escrow({
    context: context(),
    ...createFakeClients({
      allowanceReads: [BigInt(25)],
      receiptThrows: true,
    }),
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(25),
  });
  const invariantFailure = await depositToContractV1Escrow({
    context: context(),
    ...createFakeClients({
      allowanceReads: [BigInt(25)],
      postState: {
        balance: BigInt(25),
        available: BigInt(24),
        reserved: BigInt(0),
      },
    }),
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(25),
  });

  assert.equal(!uncertain.ok && uncertain.error.code, "receipt_unknown");
  assert.equal(
    !invariantFailure.ok && invariantFailure.error.code,
    "post_state_invariant_failed"
  );
});

test("withdraw succeeds for amount equal to available and preserves reserved", async () => {
  const clients = createFakeClients({
    availableReads: [BigInt(70)],
    postState: {
      balance: BigInt(100),
      available: BigInt(70),
      reserved: BigInt(30),
    },
  });
  const result = await withdrawFromContractV1Escrow({
    context: context(),
    ...clients,
    amount: BigInt(70),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    clients.writes.map((write) => write.functionName),
    ["withdraw"]
  );
  assert.equal(result.ok && result.value.postState.reserved, BigInt(30));
});

test("withdraw blocks zero, above available, and reserved balance", async () => {
  const zero = await withdrawFromContractV1Escrow({
    context: context(),
    ...createFakeClients(),
    amount: BigInt(0),
  });
  const aboveAvailable = await withdrawFromContractV1Escrow({
    context: context(),
    ...createFakeClients({
      availableReads: [BigInt(70)],
      postState: {
        balance: BigInt(100),
        available: BigInt(70),
        reserved: BigInt(30),
      },
    }),
    amount: BigInt(80),
  });

  assert.equal(!zero.ok && zero.error.code, "invalid_amount");
  assert.equal(
    !aboveAvailable.ok && aboveAvailable.error.code,
    "insufficient_available_balance"
  );
});

test("withdraw preflight blocks wrong mode, chain, wallet, config, receipt uncertainty, and invariant failure", async () => {
  const wrongMode = await withdrawFromContractV1Escrow({
    context: context({ mode: "legacy" }),
    ...createFakeClients(),
    amount: BigInt(1),
  });
  const wrongChain = await withdrawFromContractV1Escrow({
    context: context({ chainId: 1 }),
    ...createFakeClients(),
    amount: BigInt(1),
  });
  const disconnected = await withdrawFromContractV1Escrow({
    context: context({ account: null }),
    ...createFakeClients(),
    amount: BigInt(1),
  });
  const invalidConfig = await withdrawFromContractV1Escrow({
    context: context({ escrowAddress: null }),
    ...createFakeClients(),
    amount: BigInt(1),
  });
  const uncertain = await withdrawFromContractV1Escrow({
    context: context(),
    ...createFakeClients({ receiptThrows: true }),
    amount: BigInt(1),
  });
  const invariantFailure = await withdrawFromContractV1Escrow({
    context: context(),
    ...createFakeClients({
      postState: {
        balance: BigInt(100),
        available: BigInt(80),
        reserved: BigInt(30),
      },
    }),
    amount: BigInt(1),
  });

  assert.equal(!wrongMode.ok && wrongMode.error.code, "invalid_config");
  assert.equal(!wrongChain.ok && wrongChain.error.code, "wrong_chain");
  assert.equal(!disconnected.ok && disconnected.error.code, "wallet_disconnected");
  assert.equal(!invalidConfig.ok && invalidConfig.error.code, "invalid_config");
  assert.equal(!uncertain.ok && uncertain.error.code, "receipt_unknown");
  assert.equal(
    !invariantFailure.ok && invariantFailure.error.code,
    "post_state_invariant_failed"
  );
});

test("write error classifier distinguishes rejection, revert, and fallback stage errors", () => {
  assert.equal(
    classifyContractV1WriteError(
      { code: 4001 },
      "deposit_failed",
      "deposit"
    ).code,
    "transaction_rejected"
  );
  assert.equal(
    classifyContractV1WriteError(
      new Error("execution reverted"),
      "withdraw_failed",
      "withdraw"
    ).code,
    "transaction_reverted"
  );
  assert.equal(
    classifyContractV1WriteError(
      new Error("wallet unavailable"),
      "approval_failed",
      "approval"
    ).code,
    "approval_failed"
  );
});

test("write modules have no UI, storage, legacy escrow, placeBid, or lifecycle side effects", () => {
  const writesDirectory = new URL("./", import.meta.url);
  const forbidden = [
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bRedis\b|\bredis\b/,
    /from\s+["']react["']/,
    /window\.ethereum/,
    /arcEscrowAdapter/,
    /getArcEscrowAddress/,
    /NEXT_PUBLIC_PDOOH_ESCROW_ADDRESS/,
    /\bplaceBid\b/,
    /\bfinalizeSlot\b/,
    /\bconfirmPlayback\b/,
    /\bsettleSlot\b/,
    /\bexpireSlot\b/,
  ];

  for (const entry of readdirSync(writesDirectory)) {
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) {
      continue;
    }

    const source = readFileSync(new URL(entry, writesDirectory), "utf8");

    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${entry} matched ${pattern}`);
    }
  }
});
