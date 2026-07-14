export type AccountRevenueMemo = {
  ad: string;
  advertiser: `0x${string}`;
  amountMinor: string;
  company: string;
  cycleId: string;
  marketId: string;
  settlementId: `0x${string}`;
  siteId: string;
  slotId: string;
  type: "pdooh.settlement";
};

export type AccountRevenueLastPayment = {
  advertisementName: string;
  amountMinorUnits: string;
  businessName: string;
  chainId: number;
  cycleId: string;
  escrowAddress: `0x${string}`;
  marketId: string;
  settlementId: `0x${string}`;
  settledAt: string;
  siteId: string;
  slotId: string;
  status: "settled";
  transactionHash: `0x${string}`;
};

export type AccountRevenueSnapshot = {
  lastMemo: AccountRevenueMemo | null;
  lastPayment: AccountRevenueLastPayment | null;
  schemaVersion: 1;
  totalAmountMinorUnits: string;
  walletAddress: `0x${string}`;
};
