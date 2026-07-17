import { decodeEventLog, type Address, type Hash } from "viem";

import type {
  ContractV1PreWriteValidator,
  ContractV1ReadContractClient,
  ContractV1ReceiptClient,
  ContractV1TransactionReceipt,
  ContractV1TransactionRecoveryMetadata,
  ContractV1WalletWriteClient,
  ContractV1WalletWriteContext,
  ContractV1WithdrawResult,
  ContractV1WriteResult,
} from "./types";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { classifyContractV1WriteError, contractV1WriteError, contractV1WriteFailure, waitForContractV1Receipt } from "./errors.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { isValidContractV1EscrowState, readContractV1EscrowState, validateContractV1EscrowWriteContext } from "./escrowState.ts";

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

const escrowWithdrawnEventAbi = [
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export type ContractV1WithdrawInput = {
  context: ContractV1WalletWriteContext;
  readClient: ContractV1ReadContractClient;
  walletClient: ContractV1WalletWriteClient;
  receiptClient: ContractV1ReceiptClient;
  preWriteValidator: ContractV1PreWriteValidator;
  amount: bigint;
};

export async function withdrawFromContractV1Escrow({
  context,
  readClient,
  walletClient,
  receiptClient,
  preWriteValidator,
  amount,
}: ContractV1WithdrawInput): Promise<
  ContractV1WriteResult<ContractV1WithdrawResult>
> {
  const preflight = validateContractV1EscrowWriteContext(context, amount);

  if (!preflight.ok) {
    return preflight;
  }

  const { account, escrowAddress } = preflight.value;
  const preState = await readContractV1EscrowState({
    readClient,
    escrowAddress,
    account,
    stage: "preflight",
  });

  if (!preState.ok) {
    return preState;
  }

  if (!isValidContractV1EscrowState(preState.value)) {
    return contractV1WriteFailure({
      code: "post_state_invariant_failed",
      stage: "preflight",
      retryable: true,
    });
  }

  if (amount > preState.value.available) {
    return contractV1WriteFailure({
      code: "insufficient_available_balance",
      stage: "preflight",
      retryable: false,
    });
  }

  const preWrite = await preWriteValidator({
    account,
    expectedChainId: context.expectedChainId,
  });

  if (!preWrite.ok) {
    return preWrite;
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
    return {
      ok: false,
      error: classifyContractV1WriteError(error, "withdraw_failed", "withdraw"),
    };
  }

  const recovery: ContractV1TransactionRecoveryMetadata = {
    transactionHash: withdrawTransactionHash,
    action: "withdraw",
    stage: "withdraw",
    account,
    target: escrowAddress,
    amount,
  };
  const receipt = await waitForContractV1Receipt(receiptClient, recovery);

  if (!receipt.ok) {
    return receipt;
  }

  if (receipt.value.status !== "success") {
    return contractV1WriteFailure({
      code: "transaction_reverted",
      stage: "withdraw",
      retryable: false,
    });
  }

  if (!hasWithdrawnEvent({
    receipt: receipt.value,
    escrowAddress,
    account,
    amount,
  })) {
    return contractV1WriteFailure({
      code: "receipt_event_mismatch",
      stage: "receipt",
      retryable: false,
      recovery,
    });
  }

  const postState = await readContractV1EscrowState({
    readClient,
    escrowAddress,
    account,
    stage: "post_state",
    blockNumber: receipt.value.blockNumber,
  });

  if (!postState.ok) {
    return {
      ok: true,
      value: {
        withdrawTransactionHash,
        receiptStatus: "success",
        postStateStatus: "unavailable",
        postStateError: contractV1WriteError({
          code: "confirmed_post_state_unavailable",
          stage: "post_state",
          retryable: true,
          recovery,
        }),
      },
    };
  }

  if (!isValidContractV1EscrowState(postState.value)) {
    return contractV1WriteFailure({
      code: "post_state_invariant_failed",
      stage: "post_state",
      retryable: false,
      recovery,
    });
  }

  return {
    ok: true,
    value: {
      withdrawTransactionHash,
      receiptStatus: "success",
      postStateStatus: "available",
      postState: postState.value,
    },
  };
}

function hasWithdrawnEvent({
  receipt,
  escrowAddress,
  account,
  amount,
}: {
  receipt: ContractV1TransactionReceipt;
  escrowAddress: Address;
  account: Address;
  amount: bigint;
}) {
  return Boolean(
    receipt.logs?.some((log) => {
      if (log.address.toLowerCase() !== escrowAddress.toLowerCase()) {
        return false;
      }

      try {
        const topics = [...log.topics] as [Hash, ...Hash[]];
        const event = decodeEventLog({
          abi: escrowWithdrawnEventAbi,
          data: log.data,
          topics,
        });

        return (
          event.eventName === "Withdrawn" &&
          event.args.account.toLowerCase() === account.toLowerCase() &&
          event.args.amount === amount
        );
      } catch {
        return false;
      }
    })
  );
}
