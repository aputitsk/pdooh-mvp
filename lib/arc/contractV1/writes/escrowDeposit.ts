import { decodeEventLog, type Address, type Hash } from "viem";

import type {
  ContractV1ApprovalResult,
  ContractV1DepositResult,
  ContractV1PreWriteValidator,
  ContractV1ReadContractClient,
  ContractV1ReceiptClient,
  ContractV1TransactionReceipt,
  ContractV1TransactionRecoveryMetadata,
  ContractV1WalletWriteClient,
  ContractV1WalletWriteContext,
  ContractV1WriteResult,
} from "./types";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { classifyContractV1WriteError, contractV1WriteError, contractV1WriteFailure, readContractV1BigInt, waitForContractV1Receipt } from "./errors.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { isValidContractV1EscrowState, readContractV1EscrowState, validateContractV1EscrowWriteContext } from "./escrowState.ts";

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

const escrowDepositedEventAbi = [
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
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
  expectedChainId: number;
  preWriteValidator: ContractV1PreWriteValidator;
}) => Promise<ContractV1WriteResult<ContractV1ApprovalResult>>;

export type ContractV1DepositInput = {
  context: ContractV1WalletWriteContext;
  readClient: ContractV1ReadContractClient;
  walletClient: ContractV1WalletWriteClient;
  receiptClient: ContractV1ReceiptClient;
  ensureApproval: ContractV1ApprovalEnsurer;
  preWriteValidator: ContractV1PreWriteValidator;
  amount: bigint;
};

export async function depositToContractV1Escrow({
  context,
  readClient,
  walletClient,
  receiptClient,
  ensureApproval,
  preWriteValidator,
  amount,
}: ContractV1DepositInput): Promise<
  ContractV1WriteResult<ContractV1DepositResult>
> {
  const preflight = validateContractV1EscrowWriteContext(context, amount);

  if (!preflight.ok) {
    return preflight;
  }

  const { account, escrowAddress } = preflight.value;

  const walletUsdcBalance = await readWalletUsdcBalance({
    readClient,
    usdcAddress: context.usdcAddress,
    account,
  });

  if (!walletUsdcBalance.ok) {
    return walletUsdcBalance;
  }

  if (walletUsdcBalance.value < amount) {
    return contractV1WriteFailure({
      code: "insufficient_wallet_usdc",
      stage: "preflight",
      retryable: false,
    });
  }

  const approval = await ensureApproval({
    readClient,
    walletClient,
    receiptClient,
    account,
    usdcAddress: context.usdcAddress,
    spender: escrowAddress,
    amount,
    expectedChainId: context.expectedChainId,
    preWriteValidator,
  });

  if (!approval.ok) {
    return approval;
  }

  if (approval.value.allowanceVerificationStatus === "unavailable") {
    return {
      ok: false,
      error: approval.value.postStateError ?? contractV1WriteError({
        code: "confirmed_post_state_unavailable",
        stage: "post_state",
        retryable: true,
      }),
    };
  }

  const preWrite = await preWriteValidator({
    account,
    expectedChainId: context.expectedChainId,
  });

  if (!preWrite.ok) {
    return preWrite;
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
    return {
      ok: false,
      error: classifyContractV1WriteError(error, "deposit_failed", "deposit"),
    };
  }

  const recovery: ContractV1TransactionRecoveryMetadata = {
    transactionHash: depositTransactionHash,
    action: "deposit",
    stage: "deposit",
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
      stage: "deposit",
      retryable: false,
    });
  }

  if (!hasDepositedEvent({
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
        approvalTransactionHash: approval.value.approvalTransactionHash,
        depositTransactionHash,
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
      approvalTransactionHash: approval.value.approvalTransactionHash,
      depositTransactionHash,
      receiptStatus: "success",
      postStateStatus: "available",
      postState: postState.value,
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
}): Promise<ContractV1WriteResult<bigint>> {
  return readContractV1BigInt({
    readClient,
    stage: "preflight",
    request: {
      address: usdcAddress,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [account],
    },
  });
}

function hasDepositedEvent({
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
          abi: escrowDepositedEventAbi,
          data: log.data,
          topics,
        });

        return (
          event.eventName === "Deposited" &&
          event.args.account.toLowerCase() === account.toLowerCase() &&
          event.args.amount === amount
        );
      } catch {
        return false;
      }
    })
  );
}
