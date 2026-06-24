import {
  createViemAdapterFromProvider,
  type CreateViemAdapterFromProviderParams,
} from "@circle-fin/adapter-viem-v2";

import {
  ARC_CHAIN_ID,
  ARC_CHAIN_NAME,
  ARC_EXPLORER_URL,
  ARC_NATIVE_CURRENCY_SYMBOL,
  ARC_RPC_URL,
} from "./arcConstants";
import type { WalletState } from "@/lib/wallet/walletTypes";

export type BrowserWalletProvider =
  CreateViemAdapterFromProviderParams["provider"] & {
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

type DiscoveredWalletProvider = ArcWalletProviderOption & {
  provider: BrowserWalletProvider;
};

declare global {
  interface Window {
    ethereum?: BrowserWalletProvider;
  }

  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<Eip6963ProviderDetail>;
  }
}

const disconnectedWalletState: WalletState = {
  status: "disconnected",
  connected: false,
  address: null,
  chainId: null,
};
const restoringWalletState: WalletState = {
  status: "restoring",
  connected: false,
  address: null,
  chainId: null,
};
const appDisconnectedSessionKey = "pdooh-wallet-app-disconnected";
const boundProviderSessionKey = "pdooh-wallet-bound-provider";

let currentWalletState = restoringWalletState;
let activeProvider: BrowserWalletProvider | null = null;
let activeAccountsChangedListener: ((accounts: unknown) => void) | null = null;
let activeChainChangedListener: ((chainId: unknown) => void) | null = null;
let walletChangeListener: (() => void) | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

function parseChainId(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number.parseInt(value, value.startsWith("0x") ? 16 : 10);
  }

  return null;
}

function normalizeAddress(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function firstAddress(accounts: unknown) {
  return Array.isArray(accounts) ? normalizeAddress(accounts[0]) : null;
}

function createSignInMessage(address: string) {
  return [
    "Sign in to pDOOH MVP",
    "",
    "This request will not trigger a blockchain transaction or cost gas.",
    "",
    `Address: ${address}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join("\n");
}

function normalizeWalletError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const walletError = error as {
      code?: unknown;
      message?: unknown;
      shortMessage?: unknown;
    };
    const message =
      typeof walletError.message === "string"
        ? walletError.message
        : typeof walletError.shortMessage === "string"
          ? walletError.shortMessage
          : "Wallet connection failed";

    return walletError.code === undefined
      ? message
      : `${message} (code: ${String(walletError.code)})`;
  }

  return "Wallet connection failed";
}

function isUnknownChainError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const walletError = error as {
    code?: unknown;
    message?: unknown;
    shortMessage?: unknown;
  };
  const message = `${String(walletError.message ?? "")} ${String(
    walletError.shortMessage ?? ""
  )}`.toLowerCase();

  return (
    walletError.code === 4902 ||
    walletError.code === "4902" ||
    ((walletError.code === -32603 || walletError.code === "-32603") &&
      (message.includes("unrecognized chain id") ||
        message.includes("unknown chain")))
  );
}

function emitWalletChanged() {
  walletChangeListener?.();
}

function setWalletState(nextState: WalletState) {
  currentWalletState = nextState;
  emitWalletChanged();
}

function setDisconnectedWalletState() {
  setWalletState(disconnectedWalletState);
}

function isAppDisconnectLocked() {
  return (
    isBrowser() &&
    window.sessionStorage.getItem(appDisconnectedSessionKey) === "true"
  );
}

function lockAppDisconnect() {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(appDisconnectedSessionKey, "true");
}

function unlockAppDisconnect() {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(appDisconnectedSessionKey);
}

function getStoredProviderBinding(): ArcWalletProviderOption | null {
  if (!isBrowser()) {
    return null;
  }

  const storedBinding = window.sessionStorage.getItem(boundProviderSessionKey);

  if (!storedBinding) {
    return null;
  }

  try {
    const binding = JSON.parse(storedBinding) as Partial<ArcWalletProviderOption>;

    if (typeof binding.id !== "string" || typeof binding.name !== "string") {
      return null;
    }

    return {
      id: binding.id,
      name: binding.name,
      icon: typeof binding.icon === "string" ? binding.icon : null,
      rdns: typeof binding.rdns === "string" ? binding.rdns : null,
    };
  } catch {
    return null;
  }
}

function storeProviderBinding(provider: ArcWalletProviderOption) {
  if (!isBrowser()) {
    return;
  }

  const binding: ArcWalletProviderOption = {
    id: provider.id,
    name: provider.name,
    icon: provider.icon,
    rdns: provider.rdns,
  };

  window.sessionStorage.setItem(
    boundProviderSessionKey,
    JSON.stringify(binding)
  );
}

function clearProviderBinding() {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(boundProviderSessionKey);
}

function matchesProviderBinding(
  provider: DiscoveredWalletProvider,
  binding: ArcWalletProviderOption
) {
  if (binding.rdns) {
    return provider.rdns === binding.rdns;
  }

  return provider.id === binding.id;
}

async function discoverInjectedWalletProviders(): Promise<
  DiscoveredWalletProvider[]
> {
  if (!isBrowser()) {
    return [];
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

  if (eip6963Providers.length > 0) {
    return eip6963Providers;
  }

  if (window.ethereum) {
    return [
      {
        id: "window.ethereum",
        name: "Browser Wallet",
        icon: null,
        rdns: null,
        provider: window.ethereum,
      },
    ];
  }

  return [];
}

async function getInjectedWalletProvider(
  providerId?: string
): Promise<DiscoveredWalletProvider> {
  const providers = await discoverInjectedWalletProviders();

  if (providers.length === 0) {
    throw new Error("No browser wallet found.");
  }

  if (!providerId) {
    if (providers.length === 1) {
      return providers[0];
    }

    throw new Error("Choose a browser wallet.");
  }

  const selectedProvider = providers.find((provider) => provider.id === providerId);

  if (!selectedProvider) {
    throw new Error("Selected browser wallet was not found.");
  }

  return selectedProvider;
}

async function switchToArcTestnet(provider: BrowserWalletProvider) {
  const arcChainId = toHexChainId(ARC_CHAIN_ID);
  const switchToArc = () =>
    provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: arcChainId }],
    });
  const addArc = () =>
    provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: arcChainId,
          chainName: ARC_CHAIN_NAME,
          nativeCurrency: {
            name: ARC_NATIVE_CURRENCY_SYMBOL,
            symbol: ARC_NATIVE_CURRENCY_SYMBOL,
            decimals: 18,
          },
          rpcUrls: [ARC_RPC_URL],
          blockExplorerUrls: [ARC_EXPLORER_URL],
        },
      ],
    });

  try {
    await switchToArc();
  } catch (error) {
    if (!isUnknownChainError(error)) {
      throw new Error(normalizeWalletError(error));
    }

    await addArc();
    await switchToArc();
  }
}

async function getCurrentChainId(provider: BrowserWalletProvider) {
  return parseChainId(await provider.request({ method: "eth_chainId" }));
}

async function readAuthorizedWalletState(
  provider: BrowserWalletProvider
): Promise<WalletState | null> {
  const [accounts, chainId] = await Promise.all([
    provider.request({ method: "eth_accounts" }),
    provider.request({ method: "eth_chainId" }),
  ]);
  const address = firstAddress(accounts);

  if (!address) {
    return null;
  }

  return {
    status: "connected",
    connected: true,
    address,
    chainId: parseChainId(chainId),
  };
}

async function requestWalletAddress(provider: BrowserWalletProvider) {
  const address = firstAddress(
    await provider.request({
      method: "eth_requestAccounts",
      params: undefined,
    })
  );

  if (!address) {
    throw new Error("Arc wallet did not return an account address.");
  }

  return address;
}

async function requestSignInSignature(
  provider: BrowserWalletProvider,
  address: string
) {
  const request = provider.request as (args: {
    method: string;
    params?: unknown;
  }) => Promise<unknown>;

  await request({
    method: "personal_sign",
    params: [createSignInMessage(address), address],
  });
}

function unbindProviderEvents() {
  if (activeProvider && activeAccountsChangedListener) {
    activeProvider.removeListener?.(
      "accountsChanged",
      activeAccountsChangedListener
    );
  }

  if (activeProvider && activeChainChangedListener) {
    activeProvider.removeListener?.("chainChanged", activeChainChangedListener);
  }

  activeProvider = null;
  activeAccountsChangedListener = null;
  activeChainChangedListener = null;
}

function bindProviderEvents(provider: BrowserWalletProvider) {
  if (
    activeProvider === provider &&
    activeAccountsChangedListener &&
    activeChainChangedListener
  ) {
    return;
  }

  unbindProviderEvents();

  activeProvider = provider;
  activeAccountsChangedListener = (accounts: unknown) => {
    if (activeProvider !== provider) {
      return;
    }

    const nextAddress = firstAddress(accounts);

    if (!nextAddress) {
      setDisconnectedWalletState();
      return;
    }

    setWalletState({
      ...currentWalletState,
      status: "connected",
      connected: true,
      address: nextAddress,
    });
  };
  activeChainChangedListener = (chainId: unknown) => {
    if (activeProvider !== provider) {
      return;
    }

    setWalletState({
      ...currentWalletState,
      chainId: parseChainId(chainId),
    });
  };

  activeProvider.on?.("accountsChanged", activeAccountsChangedListener);
  activeProvider.on?.("chainChanged", activeChainChangedListener);
}

export function setArcWalletChangeListener(listener: () => void) {
  walletChangeListener = listener;
}

export function getArcWalletState() {
  return currentWalletState;
}

export function getActiveArcWalletProvider() {
  return activeProvider;
}

export async function getArcWalletProviders(): Promise<
  ArcWalletProviderOption[]
> {
  return (await discoverInjectedWalletProviders()).map(
    ({ id, name, icon, rdns }) => ({
      id,
      name,
      icon,
      rdns,
    })
  );
}

export async function connectArcWallet(providerId?: string) {
  try {
    const selectedProvider = await getInjectedWalletProvider(providerId);
    const { provider } = selectedProvider;

    const address = await requestWalletAddress(provider);

    await switchToArcTestnet(provider);
    await requestSignInSignature(provider, address);
    unlockAppDisconnect();
    await createViemAdapterFromProvider({
      provider,
      capabilities: { addressContext: "user-controlled" },
    });

    bindProviderEvents(provider);
    storeProviderBinding(selectedProvider);
    setWalletState({
      connected: true,
      status: "connected",
      address,
      chainId: await getCurrentChainId(provider),
    });

    return address;
  } catch (error) {
    console.warn("Arc wallet connect failed", error);
    throw new Error(normalizeWalletError(error));
  }
}

export function disconnectArcWallet() {
  lockAppDisconnect();
  clearProviderBinding();
  unbindProviderEvents();
  setDisconnectedWalletState();
}

export function formatArcWalletAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function refreshArcWalletState() {
  if (!isBrowser()) {
    return;
  }

  if (isAppDisconnectLocked()) {
    setDisconnectedWalletState();
    return;
  }

  try {
    const providers = await discoverInjectedWalletProviders();
    const storedBinding = getStoredProviderBinding();
    const selectedProvider = storedBinding
      ? providers.find((provider) =>
          matchesProviderBinding(provider, storedBinding)
        )
      : providers.length === 1
        ? providers[0]
        : null;

    if (!selectedProvider) {
      unbindProviderEvents();
      setDisconnectedWalletState();
      return;
    }

    const walletState = await readAuthorizedWalletState(
      selectedProvider.provider
    );

    bindProviderEvents(selectedProvider.provider);
    storeProviderBinding(selectedProvider);

    if (walletState) {
      setWalletState(walletState);
      return;
    }
  } catch {
    unbindProviderEvents();
    setDisconnectedWalletState();
    return;
  }

  setDisconnectedWalletState();
}
