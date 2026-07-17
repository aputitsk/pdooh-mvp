import type { Address, Hash } from "viem";

import type {
  ContractV1ApprovalResult,
  ContractV1PreWriteValidator,
  ContractV1ReadContractClient,
  ContractV1ReceiptClient,
  ContractV1WalletWriteClient,
  ContractV1WriteResult,
} from "./types";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { classifyContractV1WriteError, contractV1WriteError, contractV1WriteFailure, readContractV1BigInt, waitForContractV1Receipt } from "./errors.ts";

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
  expectedChainId: number;
  preWriteValidator: ContractV1PreWriteValidator;
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
}): Promise<ContractV1WriteResult<bigint>> {
  return readContractV1BigInt({
    readClient,
    stage: "preflight",
    request: {
      address: usdcAddress,
      abi: erc20ApprovalAbi,
      functionName: "allowance",
      args: [owner, spender],
    },
  });
}

export async function ensureContractV1UsdcApproval({
  readClient,
  walletClient,
  receiptClient,
  account,
  usdcAddress,
  spender,
  amount,
  expectedChainId,
  preWriteValidator,
}: ContractV1ApprovalInput): Promise<
  ContractV1WriteResult<ContractV1ApprovalResult>
> {
  if (amount <= BigInt(0)) {
    return contractV1WriteFailure({
      code: "invalid_amount",
      stage: "preflight",
      retryable: false,
    });
  }

  const allowanceBefore = await readContractV1UsdcAllowance({
    readClient,
    usdcAddress,
    owner: account,
    spender,
  });

  if (!allowanceBefore.ok) {
    return allowanceBefore;
  }

  if (allowanceBefore.value >= amount) {
    return {
      ok: true,
      value: {
        allowanceBefore: allowanceBefore.value,
        allowanceAfter: allowanceBefore.value,
      },
    };
  }

  const preWrite = await preWriteValidator({
    account,
    expectedChainId,
  });

  if (!preWrite.ok) {
    return preWrite;
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
    return {
      ok: false,
      error: classifyContractV1WriteError(error, "approval_failed", "approval"),
    };
  }

  const recovery = {
    transactionHash: approvalTransactionHash,
    action: "approve",
    stage: "approval",
    account,
    target: usdcAddress,
    amount,
  } as const;
  const receipt = await waitForContractV1Receipt(receiptClient, recovery);

  if (!receipt.ok) {
    return receipt;
  }

  if (receipt.value.status !== "success") {
    return contractV1WriteFailure({
      code: "transaction_reverted",
      stage: "approval",
      retryable: false,
    });
  }

  const allowanceAfter = await readContractV1UsdcAllowance({
    readClient,
    usdcAddress,
    owner: account,
    spender,
  });

  if (!allowanceAfter.ok) {
    return {
      ok: true,
      value: {
        allowanceBefore: allowanceBefore.value,
        approvalTransactionHash,
        allowanceVerificationStatus: "unavailable",
        postStateError: contractV1WriteError({
          code: "confirmed_post_state_unavailable",
          stage: "post_state",
          retryable: true,
          recovery,
        }),
      },
    };
  }

  if (allowanceAfter.value < amount) {
    return contractV1WriteFailure({
      code: "approval_failed",
      stage: "post_state",
      retryable: false,
      recovery,
    });
  }

  return {
    ok: true,
    value: {
      allowanceBefore: allowanceBefore.value,
      allowanceAfter: allowanceAfter.value,
      approvalTransactionHash,
      allowanceVerificationStatus: "verified",
    },
  };
}
