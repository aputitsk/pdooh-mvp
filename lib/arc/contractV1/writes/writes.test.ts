import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  encodeAbiParameters,
  encodeEventTopics,
  type Address,
  type Hash,
} from "viem";

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
  ContractV1ReceiptLog,
  ContractV1TransactionReceipt,
  ContractV1WalletWriteClient,
  ContractV1WalletWriteContext,
  ContractV1WriteResult,
} from "./types.ts";

const ACCOUNT = "0x00000000000000000000000000000000000000a1" as Address;
const USDC = "0x3600000000000000000000000000000000000000" as Address;
const ESCROW = "0x00000000000000000000000000000000000000e1" as Address;
const OTHER = "0x00000000000000000000000000000000000000b2" as Address;

type WriteRequest = Parameters<ContractV1WalletWriteClient["writeContract"]>[0];
type ReadRequest = Parameters<ContractV1ReadContractClient["readContract"]>[0];
type ReceiptStatus = "success" | "reverted";
type FakeReceipt = Partial<ContractV1TransactionReceipt>;

type FakeClientOptions = {
  allowanceReads?: bigint[];
  walletUsdcBalance?: bigint;
  postState?: ContractV1EscrowPostState;
  escrowStates?: ContractV1EscrowPostState[];
  writeFailures?: Partial<Record<string, unknown>>;
  readFailures?: Partial<Record<string, true>>;
  readFailureAt?: Partial<Record<string, number>>;
  receiptStatuses?: ReceiptStatus[];
  receipts?: FakeReceipt[];
  receiptThrows?: boolean;
};

const depositedEventAbi = [
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

const withdrawnEventAbi = [
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

function createFakeClients(options: FakeClientOptions = {}) {
  const writes: WriteRequest[] = [];
  const reads: ReadRequest[] = [];
  const allowanceReads = [...(options.allowanceReads ?? [BigInt(0)])];
  const receiptStatuses = [...(options.receiptStatuses ?? ["success"])];
  const receipts = [...(options.receipts ?? [])];
  const defaultState = {
    balance: BigInt(100),
    available: BigInt(70),
    reserved: BigInt(30),
  };
  const escrowStates = [...(options.escrowStates ?? [
    options.postState ?? defaultState,
  ])];
  let hashCounter = 1;
  let blockCounter = 1;
  const readCounts: Record<string, number> = {};

  const readClient: ContractV1ReadContractClient = {
    async getBlockNumber() {
      const blockNumber = BigInt(blockCounter);
      blockCounter += 1;

      return blockNumber;
    },
    async readContract(request) {
      reads.push(request);
      readCounts[request.functionName] = (readCounts[request.functionName] ?? 0) + 1;

      if (
        options.readFailures?.[request.functionName] ||
        options.readFailureAt?.[request.functionName] === readCounts[request.functionName]
      ) {
        throw new Error(`${request.functionName} read failed`);
      }

      if (request.functionName === "allowance") {
        return shiftOrLast(allowanceReads);
      }

      if (request.functionName === "balanceOf" && request.address === USDC) {
        return options.walletUsdcBalance ?? BigInt(100);
      }

      const postState = stateForBlock(escrowStates, request.blockNumber);

      if (request.functionName === "balanceOf") {
        return postState.balance;
      }

      if (request.functionName === "availableOf") {
        return postState.available;
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
        blockNumber: BigInt(2),
        logs: [],
        ...receipts.shift(),
        status: receiptStatuses.shift() ?? "success",
      };
    },
  };
  const preWrite = createValidatorRecorder(writes);

  return {
    readClient,
    walletClient,
    receiptClient,
    preWriteValidator: preWrite.validator,
    preWriteValidationCalls: preWrite.calls,
    reads,
    writes,
  };
}

function createValidatorRecorder(writes: WriteRequest[]) {
  const calls: Array<{ account: Address; expectedChainId: number; writeCount: number }> = [];

  return {
    calls,
    validator: async ({
      account,
      expectedChainId,
    }: {
      account: Address;
      expectedChainId: number;
    }): Promise<ContractV1WriteResult<void>> => {
      calls.push({
        account,
        expectedChainId,
        writeCount: writes.length,
      });

      return {
        ok: true,
        value: undefined,
      };
    },
  };
}

function eventLog({
  eventName,
  emitter = ESCROW,
  account = ACCOUNT,
  amount,
}: {
  eventName: "Deposited" | "Withdrawn";
  emitter?: Address;
  account?: Address;
  amount: bigint;
}): ContractV1ReceiptLog {
  const abi = eventName === "Deposited" ? depositedEventAbi : withdrawnEventAbi;

  return {
    address: emitter,
    topics: encodeEventTopics({
      abi,
      eventName,
      args: {
        account,
      },
    }).filter((topic): topic is Hash => typeof topic === "string"),
    data: encodeAbiParameters([{ type: "uint256" }], [amount]),
  };
}

function depositReceipt(amount: bigint, overrides: Partial<{
  emitter: Address;
  account: Address;
}> = {}): FakeReceipt {
  return {
    blockNumber: BigInt(2),
    logs: [
      eventLog({
        eventName: "Deposited",
        amount,
        ...overrides,
      }),
    ],
  };
}

function withdrawReceipt(amount: bigint, overrides: Partial<{
  emitter: Address;
  account: Address;
}> = {}): FakeReceipt {
  return {
    blockNumber: BigInt(2),
    logs: [
      eventLog({
        eventName: "Withdrawn",
        amount,
        ...overrides,
      }),
    ],
  };
}

function stateForBlock(
  states: ContractV1EscrowPostState[],
  blockNumber: bigint | undefined
) {
  if (!blockNumber) {
    return states[0];
  }

  return states[Math.min(Number(blockNumber) - 1, states.length - 1)];
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

function validatorFailure(
  code: "account_changed" | "wrong_chain" | "wallet_disconnected"
) {
  return async (): Promise<ContractV1WriteResult<void>> => ({
    ok: false,
    error: {
      code,
      stage: "preflight",
      retryable: false,
    },
  });
}

function compileOnlyMissingValidatorProof() {
  const clients = createFakeClients();

  // @ts-expect-error preWriteValidator is mandatory for approve writes.
  void ensureContractV1UsdcApproval({
    readClient: clients.readClient,
    walletClient: clients.walletClient,
    receiptClient: clients.receiptClient,
    account: ACCOUNT,
    usdcAddress: USDC,
    spender: ESCROW,
    amount: BigInt(1),
    expectedChainId: 5_042_002,
  });

  // @ts-expect-error preWriteValidator is mandatory for deposit writes.
  void depositToContractV1Escrow({
    context: context(),
    readClient: clients.readClient,
    walletClient: clients.walletClient,
    receiptClient: clients.receiptClient,
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(1),
  });

  // @ts-expect-error preWriteValidator is mandatory for withdraw writes.
  void withdrawFromContractV1Escrow({
    context: context(),
    readClient: clients.readClient,
    walletClient: clients.walletClient,
    receiptClient: clients.receiptClient,
    amount: BigInt(1),
  });
}

void compileOnlyMissingValidatorProof;

test("approval skips approve when allowance is already sufficient", async () => {
  const clients = createFakeClients({ allowanceReads: [BigInt(50)] });
  const result = await ensureContractV1UsdcApproval({
    ...clients,
    account: ACCOUNT,
    usdcAddress: USDC,
    spender: ESCROW,
    amount: BigInt(25),
    expectedChainId: 5_042_002,
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
    expectedChainId: 5_042_002,
  });

  assert.equal(result.ok, true);
  assert.equal(clients.writes.length, 1);
  assert.equal(clients.writes[0].address, USDC);
  assert.equal(clients.writes[0].functionName, "approve");
  assert.deepEqual(clients.writes[0].args, [ESCROW, BigInt(123)]);
  assert.notDeepEqual(clients.writes[0].args, [OTHER, BigInt(123)]);
  assert.deepEqual(clients.preWriteValidationCalls, [
    {
      account: ACCOUNT,
      expectedChainId: 5_042_002,
      writeCount: 0,
    },
  ]);
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
    expectedChainId: 5_042_002,
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
    expectedChainId: 5_042_002,
  });

  assert.equal(rejected.ok, false);
  assert.equal(!rejected.ok && rejected.error.code, "transaction_rejected");
  assert.equal(reverted.ok, false);
  assert.equal(!reverted.ok && reverted.error.code, "transaction_reverted");
});

test("receipt timeout retains approve transaction recovery metadata", async () => {
  const clients = createFakeClients({
    allowanceReads: [BigInt(0)],
    receiptThrows: true,
  });
  const result = await ensureContractV1UsdcApproval({
    ...clients,
    account: ACCOUNT,
    usdcAddress: USDC,
    spender: ESCROW,
    amount: BigInt(11),
    expectedChainId: 5_042_002,
  });

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "receipt_unknown");
  assert.deepEqual(!result.ok && result.error.recovery, {
    transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    action: "approve",
    stage: "approval",
    account: ACCOUNT,
    target: USDC,
    amount: BigInt(11),
  });
  assert.equal(clients.writes.length, 1);
});

test("approval read failures preserve confirmed approve identity", async () => {
  const initialReadFailure = await ensureContractV1UsdcApproval({
    ...createFakeClients({
      readFailureAt: {
        allowance: 1,
      },
    }),
    account: ACCOUNT,
    usdcAddress: USDC,
    spender: ESCROW,
    amount: BigInt(1),
    expectedChainId: 5_042_002,
  });
  const rereadFailure = await ensureContractV1UsdcApproval({
    ...createFakeClients({
      allowanceReads: [BigInt(0), BigInt(2)],
      readFailureAt: {
        allowance: 2,
      },
    }),
    account: ACCOUNT,
    usdcAddress: USDC,
    spender: ESCROW,
    amount: BigInt(1),
    expectedChainId: 5_042_002,
  });

  assert.equal(!initialReadFailure.ok && initialReadFailure.error.code, "read_failed");
  assert.equal(!initialReadFailure.ok && initialReadFailure.error.stage, "preflight");
  assert.equal(rereadFailure.ok, true);
  assert.equal(
    rereadFailure.ok && rereadFailure.value.allowanceVerificationStatus,
    "unavailable"
  );
  assert.equal(
    rereadFailure.ok && rereadFailure.value.approvalTransactionHash,
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );
  assert.equal(
    rereadFailure.ok && rereadFailure.value.postStateError?.code,
    "confirmed_post_state_unavailable"
  );
  assert.equal(
    rereadFailure.ok && rereadFailure.value.postStateError?.recovery?.action,
    "approve"
  );
});

test("confirmed approve with insufficient allowance preserves tx identity and does not retry", async () => {
  const clients = createFakeClients({
    allowanceReads: [BigInt(0), BigInt(1)],
  });
  const direct = await ensureContractV1UsdcApproval({
    ...clients,
    account: ACCOUNT,
    usdcAddress: USDC,
    spender: ESCROW,
    amount: BigInt(2),
    expectedChainId: 5_042_002,
  });
  const depositClients = createFakeClients({
    allowanceReads: [BigInt(0), BigInt(1)],
  });
  const deposit = await depositToContractV1Escrow({
    context: context(),
    ...depositClients,
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(2),
  });

  assert.equal(direct.ok, false);
  assert.equal(!direct.ok && direct.error.code, "approval_failed");
  assert.equal(!direct.ok && direct.error.stage, "post_state");
  assert.equal(
    !direct.ok && direct.error.recovery?.transactionHash,
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );
  assert.equal(clients.writes.length, 1);
  assert.equal(deposit.ok, false);
  assert.equal(!deposit.ok && deposit.error.code, "approval_failed");
  assert.deepEqual(
    depositClients.writes.map((write) => write.functionName),
    ["approve"]
  );
});

test("pre-write validator blocks approve before wallet confirmation", async () => {
  const accountChanged = await ensureContractV1UsdcApproval({
    ...createFakeClients({ allowanceReads: [BigInt(0)] }),
    account: ACCOUNT,
    usdcAddress: USDC,
    spender: ESCROW,
    amount: BigInt(1),
    expectedChainId: 5_042_002,
    preWriteValidator: validatorFailure("account_changed"),
  });
  const wrongChain = await ensureContractV1UsdcApproval({
    ...createFakeClients({ allowanceReads: [BigInt(0)] }),
    account: ACCOUNT,
    usdcAddress: USDC,
    spender: ESCROW,
    amount: BigInt(1),
    expectedChainId: 5_042_002,
    preWriteValidator: validatorFailure("wrong_chain"),
  });

  assert.equal(!accountChanged.ok && accountChanged.error.code, "account_changed");
  assert.equal(!wrongChain.ok && wrongChain.error.code, "wrong_chain");
});

test("deposit succeeds with approve then deposit and returns post-state", async () => {
  const clients = createFakeClients({
    allowanceReads: [BigInt(0), BigInt(25)],
    receipts: [{}, depositReceipt(BigInt(25))],
    escrowStates: [
      {
        balance: BigInt(0),
        available: BigInt(0),
        reserved: BigInt(0),
      },
      {
        balance: BigInt(25),
        available: BigInt(25),
        reserved: BigInt(0),
      },
    ],
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
  assert.equal(result.ok && result.value.postState?.available, BigInt(25));
  assert.deepEqual(
    clients.preWriteValidationCalls.map((call) => call.writeCount),
    [0, 1]
  );
});

test("deposit succeeds without approve when allowance is sufficient", async () => {
  const clients = createFakeClients({
    allowanceReads: [BigInt(25)],
    receipts: [depositReceipt(BigInt(25))],
    escrowStates: [
      {
        balance: BigInt(0),
        available: BigInt(0),
        reserved: BigInt(0),
      },
      {
        balance: BigInt(25),
        available: BigInt(25),
        reserved: BigInt(0),
      },
    ],
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
  assert.deepEqual(
    clients.preWriteValidationCalls.map((call) => call.writeCount),
    [0]
  );
});

test("receipt timeout retains deposit transaction recovery metadata", async () => {
  const clients = createFakeClients({
    allowanceReads: [BigInt(25)],
    receiptThrows: true,
  });
  const result = await depositToContractV1Escrow({
    context: context(),
    ...clients,
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(25),
  });

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "receipt_unknown");
  assert.deepEqual(!result.ok && result.error.recovery, {
    transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    action: "deposit",
    stage: "deposit",
    account: ACCOUNT,
    target: ESCROW,
    amount: BigInt(25),
  });
  assert.equal(clients.writes.length, 1);
});

test("deposit rejects receipt event mismatch and retains tx identity", async () => {
  for (const receipt of [
    depositReceipt(BigInt(25), { emitter: OTHER }),
    depositReceipt(BigInt(25), { account: OTHER }),
    depositReceipt(BigInt(24)),
    { blockNumber: BigInt(2), logs: [] },
  ]) {
    const clients = createFakeClients({
      allowanceReads: [BigInt(25)],
      receipts: [receipt],
    });
    const result = await depositToContractV1Escrow({
      context: context(),
      ...clients,
      ensureApproval: ensureContractV1UsdcApproval,
      amount: BigInt(25),
    });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "receipt_event_mismatch");
    assert.equal(
      !result.ok && result.error.recovery?.transactionHash,
      "0x0000000000000000000000000000000000000000000000000000000000000001"
    );
    assert.equal(clients.writes.length, 1);
  }
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

test("deposit read failures return typed results", async () => {
  const walletReadFailure = await depositToContractV1Escrow({
    context: context(),
    ...createFakeClients({
      readFailureAt: {
        balanceOf: 1,
      },
    }),
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(1),
  });
  const postStateReadFailure = await depositToContractV1Escrow({
    context: context(),
    ...createFakeClients({
      allowanceReads: [BigInt(25)],
      receipts: [depositReceipt(BigInt(25))],
      escrowStates: [
        {
          balance: BigInt(0),
          available: BigInt(0),
          reserved: BigInt(0),
        },
        {
          balance: BigInt(25),
          available: BigInt(25),
          reserved: BigInt(0),
        },
      ],
      readFailureAt: {
        balanceOf: 2,
      },
    }),
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(25),
  });

  assert.equal(!walletReadFailure.ok && walletReadFailure.error.code, "read_failed");
  assert.equal(!walletReadFailure.ok && walletReadFailure.error.stage, "preflight");
  assert.equal(postStateReadFailure.ok, true);
  assert.equal(
    postStateReadFailure.ok && postStateReadFailure.value.postStateStatus,
    "unavailable"
  );
  assert.equal(
    postStateReadFailure.ok && postStateReadFailure.value.postStateError?.code,
    "confirmed_post_state_unavailable"
  );
  assert.equal(postStateReadFailure.ok && postStateReadFailure.value.postStateError?.recovery?.action, "deposit");
});

test("pre-write validator blocks deposit before wallet confirmation", async () => {
  const accountChanged = await depositToContractV1Escrow({
    context: context(),
    ...createFakeClients({
      allowanceReads: [BigInt(25)],
    }),
    ensureApproval: ensureContractV1UsdcApproval,
    preWriteValidator: validatorFailure("account_changed"),
    amount: BigInt(25),
  });
  const wrongChain = await depositToContractV1Escrow({
    context: context(),
    ...createFakeClients({
      allowanceReads: [BigInt(25)],
    }),
    ensureApproval: ensureContractV1UsdcApproval,
    preWriteValidator: validatorFailure("wrong_chain"),
    amount: BigInt(25),
  });

  assert.equal(!accountChanged.ok && accountChanged.error.code, "account_changed");
  assert.equal(!wrongChain.ok && wrongChain.error.code, "wrong_chain");
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
      receipts: [depositReceipt(BigInt(25))],
      escrowStates: [
        {
          balance: BigInt(0),
          available: BigInt(0),
          reserved: BigInt(0),
        },
        {
          balance: BigInt(25),
          available: BigInt(24),
          reserved: BigInt(0),
        },
      ],
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

test("deposit accepts confirmed event despite concurrent reserved change", async () => {
  const concurrent = await depositToContractV1Escrow({
    context: context(),
    ...createFakeClients({
      allowanceReads: [BigInt(25)],
      receipts: [depositReceipt(BigInt(25))],
      escrowStates: [
        {
          balance: BigInt(100),
          available: BigInt(70),
          reserved: BigInt(30),
        },
        {
          balance: BigInt(125),
          available: BigInt(80),
          reserved: BigInt(45),
        },
      ],
    }),
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(25),
  });

  assert.equal(concurrent.ok, true);
  assert.equal(concurrent.ok && concurrent.value.postState?.reserved, BigInt(45));
});

test("withdraw succeeds for amount equal to available and preserves reserved", async () => {
  const clients = createFakeClients({
    receipts: [withdrawReceipt(BigInt(70))],
    escrowStates: [
      {
        balance: BigInt(100),
        available: BigInt(70),
        reserved: BigInt(30),
      },
      {
        balance: BigInt(30),
        available: BigInt(0),
        reserved: BigInt(30),
      },
    ],
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
  assert.equal(result.ok && result.value.postState?.reserved, BigInt(30));
  assert.equal(result.ok && result.value.postState?.available, BigInt(0));
  assert.deepEqual(
    clients.preWriteValidationCalls.map((call) => call.writeCount),
    [0]
  );
});

test("receipt timeout retains withdraw transaction recovery metadata", async () => {
  const clients = createFakeClients({
    receiptThrows: true,
  });
  const result = await withdrawFromContractV1Escrow({
    context: context(),
    ...clients,
    amount: BigInt(25),
  });

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "receipt_unknown");
  assert.deepEqual(!result.ok && result.error.recovery, {
    transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    action: "withdraw",
    stage: "withdraw",
    account: ACCOUNT,
    target: ESCROW,
    amount: BigInt(25),
  });
  assert.equal(clients.writes.length, 1);
});

test("withdraw rejects receipt event mismatch and retains tx identity", async () => {
  for (const receipt of [
    withdrawReceipt(BigInt(25), { emitter: OTHER }),
    withdrawReceipt(BigInt(25), { account: OTHER }),
    withdrawReceipt(BigInt(24)),
    { blockNumber: BigInt(2), logs: [] },
  ]) {
    const clients = createFakeClients({
      receipts: [receipt],
    });
    const result = await withdrawFromContractV1Escrow({
      context: context(),
      ...clients,
      amount: BigInt(25),
    });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "receipt_event_mismatch");
    assert.equal(
      !result.ok && result.error.recovery?.transactionHash,
      "0x0000000000000000000000000000000000000000000000000000000000000001"
    );
    assert.equal(clients.writes.length, 1);
  }
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
      escrowStates: [
        {
          balance: BigInt(100),
          available: BigInt(70),
          reserved: BigInt(30),
        },
      ],
    }),
    amount: BigInt(80),
  });

  assert.equal(!zero.ok && zero.error.code, "invalid_amount");
  assert.equal(
    !aboveAvailable.ok && aboveAvailable.error.code,
    "insufficient_available_balance"
  );
});

test("withdraw read failures and pre-write validation return typed results", async () => {
  const availableReadFailure = await withdrawFromContractV1Escrow({
    context: context(),
    ...createFakeClients({
      readFailures: {
        availableOf: true,
      },
    }),
    amount: BigInt(1),
  });
  const accountChanged = await withdrawFromContractV1Escrow({
    context: context(),
    ...createFakeClients(),
    preWriteValidator: validatorFailure("account_changed"),
    amount: BigInt(1),
  });
  const wrongChain = await withdrawFromContractV1Escrow({
    context: context(),
    ...createFakeClients(),
    preWriteValidator: validatorFailure("wrong_chain"),
    amount: BigInt(1),
  });

  assert.equal(!availableReadFailure.ok && availableReadFailure.error.code, "read_failed");
  assert.equal(!availableReadFailure.ok && availableReadFailure.error.stage, "preflight");
  assert.equal(!accountChanged.ok && accountChanged.error.code, "account_changed");
  assert.equal(!wrongChain.ok && wrongChain.error.code, "wrong_chain");
});

test("withdraw accepts confirmed event despite concurrent reserve release", async () => {
  const concurrent = await withdrawFromContractV1Escrow({
    context: context(),
    ...createFakeClients({
      receipts: [withdrawReceipt(BigInt(25))],
      escrowStates: [
        {
          balance: BigInt(100),
          available: BigInt(70),
          reserved: BigInt(30),
        },
        {
          balance: BigInt(75),
          available: BigInt(55),
          reserved: BigInt(20),
        },
      ],
    }),
    amount: BigInt(25),
  });

  assert.equal(concurrent.ok, true);
  assert.equal(concurrent.ok && concurrent.value.postState?.reserved, BigInt(20));
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
      receipts: [withdrawReceipt(BigInt(1))],
      escrowStates: [
        {
          balance: BigInt(100),
          available: BigInt(70),
          reserved: BigInt(30),
        },
        {
          balance: BigInt(100),
          available: BigInt(80),
          reserved: BigInt(30),
        },
      ],
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

test("escrow state reads remain block-consistent", async () => {
  const depositClients = createFakeClients({
    allowanceReads: [BigInt(25)],
    receipts: [depositReceipt(BigInt(25))],
    escrowStates: [
      {
        balance: BigInt(0),
        available: BigInt(0),
        reserved: BigInt(0),
      },
      {
        balance: BigInt(25),
        available: BigInt(25),
        reserved: BigInt(0),
      },
    ],
  });
  const withdrawClients = createFakeClients({
    receipts: [withdrawReceipt(BigInt(25))],
    escrowStates: [
      {
        balance: BigInt(100),
        available: BigInt(70),
        reserved: BigInt(30),
      },
      {
        balance: BigInt(75),
        available: BigInt(45),
        reserved: BigInt(30),
      },
    ],
  });

  await depositToContractV1Escrow({
    context: context(),
    ...depositClients,
    ensureApproval: ensureContractV1UsdcApproval,
    amount: BigInt(25),
  });
  await withdrawFromContractV1Escrow({
    context: context(),
    ...withdrawClients,
    amount: BigInt(25),
  });

  assert.deepEqual(escrowReadBlockNumbers(depositClients.reads), [BigInt(2)]);
  assert.deepEqual(escrowReadBlockNumbers(withdrawClients.reads), [
    BigInt(1),
    BigInt(2),
  ]);
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

function escrowReadBlockNumbers(reads: ReadRequest[]) {
  return [
    ...new Set(
      reads
        .filter(
          (read) =>
            read.address === ESCROW &&
            ["balanceOf", "availableOf", "reservedOf"].includes(read.functionName)
        )
        .map((read) => read.blockNumber)
    ),
  ];
}
