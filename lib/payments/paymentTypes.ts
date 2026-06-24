export type PaymentTransactionHash = `0x${string}`;

export type TreasuryPaymentLifecycle = {
  onWaitingForWallet?: () => void;
  onPending?: (transactionHash: PaymentTransactionHash) => void;
};
