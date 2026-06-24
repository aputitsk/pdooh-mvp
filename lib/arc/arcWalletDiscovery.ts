import { SUPPORTED_WALLETS } from "./arcSupportedWallets";

export type BrowserWalletProvider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void
  ) => void;
};

type Eip6963ProviderDetail = {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: BrowserWalletProvider;
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

export type DiscoveredWalletProviders = {
  eip6963: DiscoveredWalletProvider[];
  legacy: DiscoveredWalletProvider | null;
};

declare global {
  interface Window {
    ethereum?: BrowserWalletProvider;
  }

  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<Eip6963ProviderDetail>;
  }
}

export async function discoverInjectedWalletProviders(): Promise<DiscoveredWalletProviders> {
  if (typeof window === "undefined") {
    return { eip6963: [], legacy: null };
  }

  const providers = new Map<string, Eip6963ProviderDetail>();
  const onAnnounce = ((event: CustomEvent<Eip6963ProviderDetail>) => {
    providers.set(event.detail.info.uuid, event.detail);
  }) as EventListener;

  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  window.removeEventListener("eip6963:announceProvider", onAnnounce);

  const eip6963Providers = [...providers.values()].map((detail) => ({
    id: detail.info.uuid,
    name: detail.info.name,
    icon: detail.info.icon || null,
    rdns: detail.info.rdns || null,
    provider: detail.provider,
  }));

  return {
    eip6963: eip6963Providers,
    legacy: window.ethereum
      ? {
          id: "window.ethereum",
          name: "Browser Wallet",
          icon: null,
          rdns: null,
          provider: window.ethereum,
        }
      : null,
  };
}

export async function getInjectedWalletProvider(
  providerId?: string
): Promise<DiscoveredWalletProvider> {
  const { eip6963, legacy } = await discoverInjectedWalletProviders();

  if (eip6963.length === 0 && !legacy) {
    throw new Error("No browser wallet found.");
  }

  if (!providerId) {
    throw new Error("Choose a browser wallet.");
  }

  if (eip6963.length > 0) {
    const selectedProvider = eip6963.find(
      (provider) => provider.id === providerId
    );

    if (!selectedProvider) {
      throw new Error("Selected browser wallet was not found.");
    }

    return selectedProvider;
  }

  if (!legacy || providerId !== legacy.id) {
    throw new Error("Selected browser wallet was not found.");
  }

  return legacy;
}

export async function getArcWalletProviders(): Promise<
  ArcWalletCatalogOption[]
> {
  const { eip6963 } = await discoverInjectedWalletProviders();

  return SUPPORTED_WALLETS.map((wallet) => {
    const matchingProviders = eip6963.filter(
      (provider) =>
        provider.rdns !== null &&
        wallet.rdns.some((rdns) => rdns === provider.rdns)
    );
    const installedProvider =
      matchingProviders.length === 1 ? matchingProviders[0] : null;

    return {
      id: wallet.id,
      name: wallet.name,
      icon: wallet.icon ?? installedProvider?.icon ?? null,
      installed: installedProvider !== null,
      providerId: installedProvider?.id ?? null,
    };
  });
}
