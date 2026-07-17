import type { Address, Hash } from "viem";

import type {
  ContractV1ApprovalResult,
  ContractV1DepositResult,
  ContractV1EscrowPostState,
  ContractV1ReadContractClient,
  ContractV1ReceiptClient,
  ContractV1WalletWriteClient,
  ContractV1WalletWriteContext,
  ContractV1WriteError,
  ContractV1WriteResult,
} from "./types";

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const escrowDepositAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "availableOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "reservedOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type ContractV1ApprovalEnsurer = (input: {
  readClient: ContractV1ReadContractClient;
  walletClient: ContractV1WalletWriteClient;
  receiptClient: ContractV1ReceiptClient;
  account: Address;
  usdcAddress: Address;
  spender: Address;
  amount: bigint;
}) => Promise<ContractV1WriteResult<ContractV1ApprovalResult>>;

export type ContractV1DepositInput = {
  context: ContractV1WalletWriteContext;
  readClient: ContractV1ReadContractClient;
  walletClient: ContractV1WalletWriteClient;
  receiptClient: ContractV1ReceiptClient;
  ensureApproval: ContractV1ApprovalEnsurer;
  amount: bigint;
};

export async function depositToContractV1Escrow({
  context,
  readClient,
  walletClient,
  receiptClient,
  ensureApproval,
  amount,
}: ContractV1DepositInput): Promise<
  ContractV1WriteResult<ContractV1DepositResult>
> {
  const preflight = validateCommonWriteContext(context, amount);

  if (!preflight.ok) {
    return preflight;
  }

  const { account, escrowAddress } = preflight.value;

  const walletUsdcBalance = await readWalletUsdcBalance({
    readClient,
    usdcAddress: context.usdcAddress,
    account,
  });

  if (walletUsdcBalance < amount) {
    return failure("insufficient_wallet_usdc", "preflight", false);
  }

  const approval = await ensureApproval({
    readClient,
    walletClient,
    receiptClient,
    account,
    usdcAddress: context.usdcAddress,
    spender: escrowAddress,
    amount,
  });

  if (!approval.ok) {
    return approval;
  }

  let depositTransactionHash: Hash;

  try {
    depositTransactionHash = await walletClient.writeContract({
      account,
      address: escrowAddress,
      abi: escrowDepositAbi,
      functionName: "deposit",
      args: [amount],
    });
  } catch (error) {
    return failure(classifyWriteFailure(error, "deposit_failed"), "deposit", true);
  }

  const receipt = await waitForReceipt(receiptClient, depositTransactionHash);

  if (!receipt.ok) {
    return receipt;
  }

  if (receipt.value.status !== "success") {
    return failure("transaction_reverted", "deposit", false);
  }

  const postState = await readEscrowPostState({
    readClient,
    escrowAddress,
    account,
  });

  if (!isValidPostState(postState)) {
    return failure("post_state_invariant_failed", "post_state", true);
  }

  return {
    ok: true,
    value: {
      approvalTransactionHash: approval.value.approvalTransactionHash,
      depositTransactionHash,
      receiptStatus: "success",
      postState,
    },
  };
}

async function readWalletUsdcBalance({
  readClient,
  usdcAddress,
  account,
}: {
  readClient: ContractV1ReadContractClient;
  usdcAddress: Address;
  account: Address;
}) {
  return asBigInt(
    await readClient.readContract({
      address: usdcAddress,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [account],
    })
  );
}

async function readEscrowPostState({
  readClient,
  escrowAddress,
  account,
}: {
  readClient: ContractV1ReadContractClient;
  escrowAddress: Address;
  account: Address;
}): Promise<ContractV1EscrowPostState> {
  const [balance, available, reserved] = await Promise.all([
    readClient.readContract({
      address: escrowAddress,
      abi: escrowDepositAbi,
      functionName: "balanceOf",
      args: [account],
    }),
    readClient.readContract({
      address: escrowAddress,
      abi: escrowDepositAbi,
      functionName: "availableOf",
      args: [account],
    }),
    readClient.readContract({
      address: escrowAddress,
      abi: escrowDepositAbi,
      functionName: "reservedOf",
      args: [account],
    }),
  ]);

  return {
    balance: asBigInt(balance),
    available: asBigInt(available),
    reserved: asBigInt(reserved),
  };
}

function validateCommonWriteContext(
  context: ContractV1WalletWriteContext,
  amount: bigint
): ContractV1WriteResult<{ account: Address; escrowAddress: Address }> {
  if (context.mode !== "contract_v1" || !context.configValid || !context.escrowAddress) {
    return failure("invalid_config", "preflight", false);
  }

  if (context.chainId !== context.expectedChainId) {
    return failure("wrong_chain", "preflight", false);
  }

  if (!context.account) {
    return failure("wallet_disconnected", "preflight", false);
  }

  if (amount <= BigInt(0)) {
    return failure("invalid_amount", "preflight", false);
  }

  return {
    ok: true,
    value: {
      account: context.account,
      escrowAddress: context.escrowAddress,
    },
  };
}

function isValidPostState(state: ContractV1EscrowPostState) {
  return state.available + state.reserved === state.balance;
}

function asBigInt(value: unknown) {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }

  throw new TypeError("Contract V1 escrow read must return an integer.");
}

async function waitForReceipt(
  receiptClient: ContractV1ReceiptClient,
  hash: Hash
): Promise<ContractV1WriteResult<{ status: "success" | "reverted" }>> {
  try {
    return {
      ok: true,
      value: await receiptClient.waitForTransactionReceipt({ hash }),
    };
  } catch {
    return failure("receipt_unknown", "receipt", true);
  }
}

function classifyWriteFailure(
  error: unknown,
  defaultCode: ContractV1WriteError["code"]
) {
  const text = collectErrorText(error).join(" ").toLowerCase();

  if (hasCode(error, 4001) || text.includes("user rejected")) {
    return "transaction_rejected";
  }

  if (text.includes("execution reverted") || text.includes("transaction reverted")) {
    return "transaction_reverted";
  }

  return defaultCode;
}

function hasCode(error: unknown, expectedCode: number): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const record = error as Record<string, unknown>;

  return record.code === expectedCode || record.code === String(expectedCode);
}

function collectErrorText(error: unknown): string[] {
  if (error instanceof Error) {
    return [error.name, error.message];
  }

  if (typeof error === "string") {
    return [error];
  }

  if (typeof error !== "object" || error === null) {
    return [];
  }

  const record = error as Record<string, unknown>;
  const values: string[] = [];

  for (const field of ["name", "message", "shortMessage", "details"]) {
    const value = record[field];

    if (typeof value === "string") {
      values.push(value);
    }
  }

  return values;
}

function failure(
  code: ContractV1WriteError["code"],
  stage: ContractV1WriteError["stage"],
  retryable: boolean
): ContractV1WriteResult<never> {
  return {
    ok: false,
    error: {
      code,
      stage,
      retryable,
    },
  };
}
