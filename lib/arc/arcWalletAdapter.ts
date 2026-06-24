import {
  discoverInjectedWalletProviders,
  getInjectedWalletProvider,
  type BrowserWalletProvider,
} from "./arcWalletDiscovery";
import { normalizeWalletError } from "./arcWalletErrors";
import {
  getCurrentChainId,
  parseChainId,
  switchToArcTestnet,
} from "./arcWalletNetwork";
import {
  clearProviderBinding,
  getStoredProviderBinding,
  isAppDisconnectLocked,
  lockAppDisconnect,
  storeProviderBinding,
  unlockAppDisconnect,
} from "./arcWalletSession";
import type { ArcWalletState } from "./arcWalletTypes";

export {
  getArcWalletProviders,
  type ArcWalletCatalogOption,
  type ArcWalletProviderOption,
  type BrowserWalletProvider,
} from "./arcWalletDiscovery";

export type ArcWalletConnectResult =
  | {
      ok: true;
      address: string;
    }
  | {
      ok: false;
      error: Error;
    };

const disconnectedWalletState: ArcWalletState = {
  status: "disconnected",
  connected: false,
  address: null,
  chainId: null,
};

const restoringWalletState: ArcWalletState = {
  status: "restoring",
  connected: false,
  address: null,
  chainId: null,
};

const metamaskRdns = "io.metamask";
const walletConnectTimeoutMs = 30_000;

let currentWalletState = restoringWalletState;
let activeProvider: BrowserWalletProvider | null = null;
let activeAccountsChangedListener: ((accounts: unknown) => void) | null = null;
let activeChainChangedListener: ((chainId: unknown) => void) | null = null;
let walletChangeListener: (() => void) | null = null;
let activeConnectPromise: Promise<ArcWalletConnectResult> | null = null;

function isBrowser() {
  return typeof window !== "undefined";
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

function emitWalletChanged() {
  walletChangeListener?.();
}

function setWalletState(nextState: ArcWalletState) {
  currentWalletState = nextState;
  emitWalletChanged();
}

function setDisconnectedWalletState() {
  setWalletState(disconnectedWalletState);
}

async function readAuthorizedWalletState(
  provider: BrowserWalletProvider
): Promise<ArcWalletState | null> {
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
    await withTimeout(
      Promise.resolve().then(() =>
        provider.request({
          method: "eth_requestAccounts",
          params: undefined,
        })
      ),
      walletConnectTimeoutMs,
      "Wallet connection timed out. Please retry."
    )
  );

  if (!address) {
    throw new Error("Arc wallet did not return an account address.");
  }

  return address;
}

function withTimeout<T>(
  request: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    request.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
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
    const currentAddress = currentWalletState.address;

    if (
      !nextAddress ||
      !currentWalletState.connected ||
      !currentAddress ||
      nextAddress.toLowerCase() !== currentAddress.toLowerCase()
    ) {
      disconnectArcWallet();
      return;
    }
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

async function performArcWalletConnect(providerId?: string) {
  try {
    const selectedProvider = await getInjectedWalletProvider(providerId);
    const { provider } = selectedProvider;

    const address = await requestWalletAddress(provider);

    await switchToArcTestnet(provider);
    await requestSignInSignature(provider, address);
    unlockAppDisconnect();
    bindProviderEvents(provider);
    storeProviderBinding(selectedProvider);
    setWalletState({
      connected: true,
      status: "connected",
      address,
      chainId: await getCurrentChainId(provider),
    });

    return {
      ok: true,
      address,
    } satisfies ArcWalletConnectResult;
  } catch (error) {
    clearProviderBinding();
    unbindProviderEvents();
    setDisconnectedWalletState();
    return {
      ok: false,
      error: normalizeWalletError(error),
    } satisfies ArcWalletConnectResult;
  }
}

export function connectArcWallet(
  providerId?: string
): Promise<ArcWalletConnectResult> {
  if (activeConnectPromise) {
    return activeConnectPromise;
  }

  const connectPromise = performArcWalletConnect(providerId).finally(() => {
    if (activeConnectPromise === connectPromise) {
      activeConnectPromise = null;
    }
  });

  activeConnectPromise = connectPromise;
  return connectPromise;
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
    clearProviderBinding();
    unbindProviderEvents();
    setDisconnectedWalletState();
    return;
  }

  try {
    const { eip6963 } = await discoverInjectedWalletProviders();

    if (isAppDisconnectLocked()) {
      clearProviderBinding();
      unbindProviderEvents();
      setDisconnectedWalletState();
      return;
    }

    const storedBinding = getStoredProviderBinding();

    if (storedBinding?.rdns === metamaskRdns) {
      clearProviderBinding();
      unbindProviderEvents();
      setDisconnectedWalletState();
      return;
    }

    const selectedProvider = storedBinding?.rdns
      ? eip6963.find((provider) => provider.rdns === storedBinding.rdns)
      : null;

    if (!selectedProvider) {
      clearProviderBinding();
      unbindProviderEvents();
      setDisconnectedWalletState();
      return;
    }

    const walletState = await readAuthorizedWalletState(
      selectedProvider.provider
    );

    if (isAppDisconnectLocked()) {
      clearProviderBinding();
      unbindProviderEvents();
      setDisconnectedWalletState();
      return;
    }

    bindProviderEvents(selectedProvider.provider);
    storeProviderBinding(selectedProvider);

    if (walletState) {
      setWalletState(walletState);
      return;
    }
  } catch {
    clearProviderBinding();
    unbindProviderEvents();
    setDisconnectedWalletState();
    return;
  }

  clearProviderBinding();
  unbindProviderEvents();
  setDisconnectedWalletState();
}
