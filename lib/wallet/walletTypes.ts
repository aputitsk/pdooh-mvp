export type WalletState = {
  status: "restoring" | "connected" | "disconnected";
  connected: boolean;
  address: string | null;
  chainId?: number | null;
};
