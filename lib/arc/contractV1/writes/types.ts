import type { Address, Hash, Hex } from "viem";

import type { ContractV1AppMode } from "../types";

export type ContractV1WriteErrorCode =
  | "transaction_rejected"
  | "transaction_reverted"
  | "receipt_unknown"
  | "receipt_event_mismatch"
  | "confirmed_post_state_unavailable"
  | "read_failed"
  | "wrong_chain"
  | "wallet_disconnected"
  | "account_changed"
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

export type ContractV1TransactionRecoveryMetadata = {
  transactionHash: Hash;
  action: "approve" | "deposit" | "withdraw";
  stage: ContractV1WriteStage;
  account: Address;
  target: Address;
  amount: bigint;
};

export type ContractV1WriteError = {
  code: ContractV1WriteErrorCode;
  stage: ContractV1WriteStage;
  retryable: boolean;
  recovery?: ContractV1TransactionRecoveryMetadata;
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
  blockNumber?: bigint;
  logs?: readonly ContractV1ReceiptLog[];
};

export type ContractV1ReceiptLog = {
  address: Address;
  topics: readonly Hash[];
  data: Hex;
};

export type ContractV1ReadContractClient = {
  getBlockNumber?(): Promise<bigint>;
  readContract(request: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
    blockNumber?: bigint;
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

export type ContractV1PreWriteValidationInput = {
  account: Address;
  expectedChainId: number;
};

export type ContractV1PreWriteValidator = (
  input: ContractV1PreWriteValidationInput
) => Promise<ContractV1WriteResult<void>>;

export type ContractV1EscrowState = {
  balance: bigint;
  available: bigint;
  reserved: bigint;
  blockNumber?: bigint;
};

export type ContractV1EscrowPostState = ContractV1EscrowState;

export type ContractV1ApprovalResult = {
  allowanceBefore: bigint;
  allowanceAfter?: bigint;
  approvalTransactionHash?: Hash;
  allowanceVerificationStatus?: "verified" | "unavailable";
  postStateError?: ContractV1WriteError;
};

export type ContractV1DepositResult = {
  approvalTransactionHash?: Hash;
  depositTransactionHash: Hash;
  receiptStatus: "success";
  postStateStatus: "available" | "unavailable";
  postState?: ContractV1EscrowPostState;
  postStateError?: ContractV1WriteError;
};

export type ContractV1WithdrawResult = {
  withdrawTransactionHash: Hash;
  receiptStatus: "success";
  postStateStatus: "available" | "unavailable";
  postState?: ContractV1EscrowPostState;
  postStateError?: ContractV1WriteError;
};
