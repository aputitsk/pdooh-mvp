export type WalletSource = "appkit" | "privy";

export type ArcWalletState = {
  status: "restoring" | "connected" | "disconnected";
  connected: boolean;
  address: string | null;
  chainId?: number | null;
  source: WalletSource | null;
};
