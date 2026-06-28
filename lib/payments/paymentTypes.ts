export type PaymentTransactionHash = `0x${string}`;

export type TreasuryPaymentLifecycle = {
  onWaitingForWallet?: () => void;
  onPending?: (transactionHash: PaymentTransactionHash) => void;
};

export type EscrowDepositLifecycle = {
  onApprovalWalletRequest?: () => void;
  onApprovalPending?: (transactionHash: PaymentTransactionHash) => void;
  onApprovalConfirmed?: (transactionHash: PaymentTransactionHash) => void;
  onDepositWalletRequest?: () => void;
  onDepositPending?: (transactionHash: PaymentTransactionHash) => void;
};

export type EscrowDepositResult = {
  approvalTransactionHash: PaymentTransactionHash;
  depositTransactionHash: PaymentTransactionHash;
};

export type EscrowWithdrawLifecycle = {
  onWithdrawWalletRequest?: () => void;
  onWithdrawPending?: (transactionHash: PaymentTransactionHash) => void;
};

export type EscrowWithdrawResult = {
  withdrawTransactionHash: PaymentTransactionHash;
};
