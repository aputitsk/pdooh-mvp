export type SupportedWalletDefinition = {
  id: string;
  name: string;
  rdns: readonly string[];
  icon: string | null;
};

export const SUPPORTED_WALLETS = [
  {
    id: "rabby",
    name: "Rabby Wallet",
    rdns: ["io.rabby"],
    icon: null,
  },
  {
    id: "okx",
    name: "OKX Wallet",
    rdns: ["com.okex.wallet"],
    icon: null,
  },
  {
    id: "metamask",
    name: "MetaMask",
    rdns: ["io.metamask"],
    icon: null,
  },
] as const satisfies readonly SupportedWalletDefinition[];
