import type { Address, Hash } from "viem";

import type { ContractV1AppMode } from "../types";

export type ContractV1WriteErrorCode =
  | "transaction_rejected"
  | "transaction_reverted"
  | "receipt_unknown"
  | "wrong_chain"
  | "wallet_disconnected"
  | "invalid_config"
  | "invalid_amount"
  | "insufficient_wallet_usdc"
  | "insufficient_available_balance"
  | "approval_failed"
  | "deposit_failed"
  | "withdraw_failed"
  | "post_state_invariant_failed";

export type ContractV1WriteStage =
  | "preflight"
  | "approval"
  | "deposit"
  | "withdraw"
  | "receipt"
  | "post_state";

export type ContractV1WriteError = {
  code: ContractV1WriteErrorCode;
  stage: ContractV1WriteStage;
  retryable: boolean;
};

export type ContractV1WriteResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: ContractV1WriteError;
    };

export type ContractV1ReceiptStatus = "success" | "reverted";

export type ContractV1TransactionReceipt = {
  status: ContractV1ReceiptStatus;
};

export type ContractV1ReadContractClient = {
  readContract(request: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
};

export type ContractV1WalletWriteClient = {
  writeContract(request: {
    account: Address;
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<Hash>;
};

export type ContractV1ReceiptClient = {
  waitForTransactionReceipt(request: {
    hash: Hash;
  }): Promise<ContractV1TransactionReceipt>;
};

export type ContractV1WalletWriteContext = {
  mode: ContractV1AppMode;
  configValid: boolean;
  chainId: number | null;
  expectedChainId: number;
  account: Address | null;
  escrowAddress: Address | null;
  usdcAddress: Address;
};

export type ContractV1EscrowPostState = {
  balance: bigint;
  available: bigint;
  reserved: bigint;
};

export type ContractV1ApprovalResult = {
  allowanceBefore: bigint;
  allowanceAfter: bigint;
  approvalTransactionHash?: Hash;
};

export type ContractV1DepositResult = {
  approvalTransactionHash?: Hash;
  depositTransactionHash: Hash;
  receiptStatus: "success";
  postState: ContractV1EscrowPostState;
};

export type ContractV1WithdrawResult = {
  withdrawTransactionHash: Hash;
  receiptStatus: "success";
  postState: ContractV1EscrowPostState;
};
