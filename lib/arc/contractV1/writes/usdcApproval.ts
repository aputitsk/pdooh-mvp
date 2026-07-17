import type { Address, Hash } from "viem";

import type {
  ContractV1ApprovalResult,
  ContractV1ReadContractClient,
  ContractV1ReceiptClient,
  ContractV1WalletWriteClient,
  ContractV1WriteError,
  ContractV1WriteResult,
} from "./types";

const erc20ApprovalAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export type ContractV1ApprovalInput = {
  readClient: ContractV1ReadContractClient;
  walletClient: ContractV1WalletWriteClient;
  receiptClient: ContractV1ReceiptClient;
  account: Address;
  usdcAddress: Address;
  spender: Address;
  amount: bigint;
};

export async function readContractV1UsdcAllowance({
  readClient,
  usdcAddress,
  owner,
  spender,
}: {
  readClient: ContractV1ReadContractClient;
  usdcAddress: Address;
  owner: Address;
  spender: Address;
}): Promise<bigint> {
  return asBigInt(
    await readClient.readContract({
      address: usdcAddress,
      abi: erc20ApprovalAbi,
      functionName: "allowance",
      args: [owner, spender],
    })
  );
}

export async function ensureContractV1UsdcApproval({
  readClient,
  walletClient,
  receiptClient,
  account,
  usdcAddress,
  spender,
  amount,
}: ContractV1ApprovalInput): Promise<
  ContractV1WriteResult<ContractV1ApprovalResult>
> {
  if (amount <= BigInt(0)) {
    return failure("invalid_amount", "preflight", false);
  }

  const allowanceBefore = await readContractV1UsdcAllowance({
    readClient,
    usdcAddress,
    owner: account,
    spender,
  });

  if (allowanceBefore >= amount) {
    return {
      ok: true,
      value: {
        allowanceBefore,
        allowanceAfter: allowanceBefore,
      },
    };
  }

  let approvalTransactionHash: Hash;

  try {
    approvalTransactionHash = await walletClient.writeContract({
      account,
      address: usdcAddress,
      abi: erc20ApprovalAbi,
      functionName: "approve",
      args: [spender, amount],
    });
  } catch (error) {
    return failure(classifyWriteFailure(error, "approval_failed"), "approval", true);
  }

  const receipt = await waitForReceipt(receiptClient, approvalTransactionHash);

  if (!receipt.ok) {
    return receipt;
  }

  if (receipt.value.status !== "success") {
    return failure("transaction_reverted", "approval", false);
  }

  const allowanceAfter = await readContractV1UsdcAllowance({
    readClient,
    usdcAddress,
    owner: account,
    spender,
  });

  if (allowanceAfter < amount) {
    return failure("approval_failed", "approval", true);
  }

  return {
    ok: true,
    value: {
      allowanceBefore,
      allowanceAfter,
      approvalTransactionHash,
    },
  };
}

function asBigInt(value: unknown) {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }

  throw new TypeError("Contract V1 USDC allowance read must return an integer.");
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
