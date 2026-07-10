import {
  getCurrentChainId,
  parseChainId,
  switchToArcTestnet,
} from "./arcWalletNetwork";
import type { ArcWalletState } from "./arcWalletTypes";
import type { BrowserWalletProvider } from "./arcWalletDiscovery";

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

type AppKitWalletSyncInput = {
  address: string;
  chainId?: number | string | null;
  provider: BrowserWalletProvider;
};

const disconnectedWalletState: ArcWalletState = {
  status: "disconnected",
  connected: false,
  address: null,
  chainId: null,
};

let currentWalletState = disconnectedWalletState;
let activeProvider: BrowserWalletProvider | null = null;
let activeAccountsChangedListener: ((accounts: unknown) => void) | null = null;
let activeChainChangedListener: ((chainId: unknown) => void) | null = null;
let walletChangeListener: (() => void) | null = null;
let activeSyncToken = 0;

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeAddress(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function firstAddress(accounts: unknown) {
  return Array.isArray(accounts) ? normalizeAddress(accounts[0]) : null;
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
      resetArcWalletFromAppKit();
      return;
    }

    setWalletState({
      ...currentWalletState,
      connected: true,
      status: "connected",
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

async function readProviderChainId(provider: BrowserWalletProvider) {
  try {
    return await getCurrentChainId(provider);
  } catch {
    return null;
  }
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

export async function syncArcWalletFromAppKit({
  address,
  chainId,
  provider,
}: AppKitWalletSyncInput) {
  const syncToken = ++activeSyncToken;
  let nextChainId = parseChainId(chainId);

  try {
    await switchToArcTestnet(provider);
    nextChainId = await readProviderChainId(provider);
  } catch {
    nextChainId = (await readProviderChainId(provider)) ?? nextChainId;
  }

  if (syncToken !== activeSyncToken) {
    return;
  }

  bindProviderEvents(provider);
  setWalletState({
    connected: true,
    status: "connected",
    address,
    chainId: nextChainId,
  });
}

export function resetArcWalletFromAppKit() {
  activeSyncToken += 1;
  unbindProviderEvents();
  setDisconnectedWalletState();
}

export function connectArcWallet(
  _providerId?: string
): Promise<ArcWalletConnectResult> {
  void _providerId;

  return Promise.resolve({
    ok: false,
    error: new Error("Open the Reown AppKit wallet modal to connect."),
  });
}

export function disconnectArcWallet() {
  resetArcWalletFromAppKit();
}

export function formatArcWalletAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function refreshArcWalletState() {
  if (!isBrowser()) {
    return;
  }

  setDisconnectedWalletState();
}
