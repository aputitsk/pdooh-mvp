import type { Address, Hash } from "viem";

import type {
  ContractV1EscrowPostState,
  ContractV1ReadContractClient,
  ContractV1ReceiptClient,
  ContractV1WalletWriteClient,
  ContractV1WalletWriteContext,
  ContractV1WithdrawResult,
  ContractV1WriteError,
  ContractV1WriteResult,
} from "./types";

const escrowWithdrawAbi = [
  {
    type: "function",
    name: "withdraw",
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

export type ContractV1WithdrawInput = {
  context: ContractV1WalletWriteContext;
  readClient: ContractV1ReadContractClient;
  walletClient: ContractV1WalletWriteClient;
  receiptClient: ContractV1ReceiptClient;
  amount: bigint;
};

export async function withdrawFromContractV1Escrow({
  context,
  readClient,
  walletClient,
  receiptClient,
  amount,
}: ContractV1WithdrawInput): Promise<
  ContractV1WriteResult<ContractV1WithdrawResult>
> {
  const preflight = validateCommonWriteContext(context, amount);

  if (!preflight.ok) {
    return preflight;
  }

  const { account, escrowAddress } = preflight.value;
  const available = await readEscrowAvailable({
    readClient,
    escrowAddress,
    account,
  });

  if (amount > available) {
    return failure("insufficient_available_balance", "preflight", false);
  }

  let withdrawTransactionHash: Hash;

  try {
    withdrawTransactionHash = await walletClient.writeContract({
      account,
      address: escrowAddress,
      abi: escrowWithdrawAbi,
      functionName: "withdraw",
      args: [amount],
    });
  } catch (error) {
    return failure(classifyWriteFailure(error, "withdraw_failed"), "withdraw", true);
  }

  const receipt = await waitForReceipt(receiptClient, withdrawTransactionHash);

  if (!receipt.ok) {
    return receipt;
  }

  if (receipt.value.status !== "success") {
    return failure("transaction_reverted", "withdraw", false);
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
      withdrawTransactionHash,
      receiptStatus: "success",
      postState,
    },
  };
}

async function readEscrowAvailable({
  readClient,
  escrowAddress,
  account,
}: {
  readClient: ContractV1ReadContractClient;
  escrowAddress: Address;
  account: Address;
}) {
  return asBigInt(
    await readClient.readContract({
      address: escrowAddress,
      abi: escrowWithdrawAbi,
      functionName: "availableOf",
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
      abi: escrowWithdrawAbi,
      functionName: "balanceOf",
      args: [account],
    }),
    readClient.readContract({
      address: escrowAddress,
      abi: escrowWithdrawAbi,
      functionName: "availableOf",
      args: [account],
    }),
    readClient.readContract({
      address: escrowAddress,
      abi: escrowWithdrawAbi,
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
