import { SUPPORTED_WALLETS } from "./arcSupportedWallets";

export type BrowserWalletProvider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void
  ) => void;
  providers?: BrowserWalletProvider[];
  isMetaMask?: boolean;
  isRabby?: boolean;
  isOkxWallet?: boolean;
  isOKExWallet?: boolean;
  isOKXWallet?: boolean;
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
  legacy: DiscoveredWalletProvider[];
};

declare global {
  interface Window {
    ethereum?: BrowserWalletProvider;
  }

  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<Eip6963ProviderDetail>;
  }
}

const legacyProviderId = "window.ethereum";

function isTruthyProviderFlag(value: unknown) {
  return value === true;
}

function getLegacyProviderWallet(provider: BrowserWalletProvider) {
  if (isTruthyProviderFlag(provider.isRabby)) {
    return SUPPORTED_WALLETS.find((wallet) => wallet.id === "rabby") ?? null;
  }

  if (
    isTruthyProviderFlag(provider.isOkxWallet) ||
    isTruthyProviderFlag(provider.isOKExWallet) ||
    isTruthyProviderFlag(provider.isOKXWallet)
  ) {
    return SUPPORTED_WALLETS.find((wallet) => wallet.id === "okx") ?? null;
  }

  if (isTruthyProviderFlag(provider.isMetaMask)) {
    return SUPPORTED_WALLETS.find((wallet) => wallet.id === "metamask") ?? null;
  }

  return null;
}

function getLegacyWalletProviders() {
  if (!window.ethereum) {
    return [];
  }

  const rawProviders =
    Array.isArray(window.ethereum.providers) &&
    window.ethereum.providers.length > 0
      ? window.ethereum.providers
      : [window.ethereum];
  const providers: DiscoveredWalletProvider[] = [];
  const seenProviderIds = new Set<string>();

  rawProviders.forEach((provider) => {
    const wallet = getLegacyProviderWallet(provider);

    if (!wallet) {
      return;
    }

    const id = `${legacyProviderId}:${wallet.id}`;

    if (seenProviderIds.has(id)) {
      return;
    }

    seenProviderIds.add(id);
    providers.push({
      id,
      name: wallet.name,
      icon: wallet.icon,
      rdns: wallet.rdns[0] ?? null,
      provider,
    });
  });

  if (providers.length > 0) {
    return providers;
  }

  return [
    {
      id: legacyProviderId,
      name: "Browser Wallet",
      icon: null,
      rdns: null,
      provider: window.ethereum,
    },
  ];
}

export async function discoverInjectedWalletProviders(): Promise<DiscoveredWalletProviders> {
  if (typeof window === "undefined") {
    return { eip6963: [], legacy: [] };
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
    legacy: getLegacyWalletProviders(),
  };
}

export async function getInjectedWalletProvider(
  providerId?: string
): Promise<DiscoveredWalletProvider> {
  const { eip6963, legacy } = await discoverInjectedWalletProviders();
  const providers = [...eip6963, ...legacy];

  if (providers.length === 0) {
    throw new Error("No browser wallet found.");
  }

  if (!providerId) {
    throw new Error("Choose a browser wallet.");
  }

  const selectedProvider = providers.find(
    (provider) => provider.id === providerId
  );

  if (selectedProvider) {
    return selectedProvider;
  }

  throw new Error("Selected browser wallet was not found.");
}

export async function getArcWalletProviders(): Promise<
  ArcWalletCatalogOption[]
> {
  const { eip6963, legacy } = await discoverInjectedWalletProviders();

  const supportedWalletOptions = SUPPORTED_WALLETS.map((wallet) => {
    const matchingProviders = eip6963.filter(
      (provider) =>
        provider.rdns !== null &&
        wallet.rdns.some((rdns) => rdns === provider.rdns)
    );
    const matchingLegacyProvider =
      legacy.find(
        (provider) =>
          provider.rdns !== null &&
          wallet.rdns.some((rdns) => rdns === provider.rdns)
      ) ?? null;
    const installedProvider = matchingProviders[0] ?? matchingLegacyProvider;

    return {
      id: wallet.id,
      name: wallet.name,
      icon: wallet.icon ?? installedProvider?.icon ?? null,
      installed: installedProvider !== null,
      providerId: installedProvider?.id ?? null,
    };
  });

  const hasSupportedProvider = supportedWalletOptions.some(
    (provider) => provider.installed
  );
  const genericLegacyOptions = hasSupportedProvider
    ? []
    : legacy
        .filter((provider) => provider.rdns === null)
        .map((provider) => ({
          id: provider.id,
          name: provider.name,
          icon: provider.icon,
          installed: true,
          providerId: provider.id,
        }));

  return [...supportedWalletOptions, ...genericLegacyOptions];
}
