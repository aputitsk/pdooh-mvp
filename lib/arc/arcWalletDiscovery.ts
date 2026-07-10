export type BrowserWalletProvider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void
  ) => void;
  disconnect?: () => Promise<void>;
};

export type ArcWalletProviderOption = {
  id: string;
  name: string;
  icon: string | null;
  rdns: string | null;
};

export type ArcWalletCatalogOption = {
  id: string;
  name: string;
  icon: string | null;
  installed: boolean;
  providerId: string | null;
};

export type DiscoveredWalletProvider = ArcWalletProviderOption & {
  provider: BrowserWalletProvider;
};

export async function getArcWalletProviders(): Promise<
  ArcWalletCatalogOption[]
> {
  return [
    {
      id: "reown-appkit",
      name: "Reown AppKit",
      icon: null,
      installed: true,
      providerId: "reown-appkit",
    },
  ];
}
