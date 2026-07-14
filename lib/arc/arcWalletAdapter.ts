import {
  getCurrentChainId,
  parseChainId,
} from "./arcWalletNetwork";
import type { ArcWalletState, WalletSource } from "./arcWalletTypes";
import type { BrowserWalletProvider } from "./arcWalletDiscovery";

export type { WalletSource } from "./arcWalletTypes";

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

type ArcWalletSyncInput = AppKitWalletSyncInput & {
  source: WalletSource;
};

const disconnectedWalletState: ArcWalletState = {
  status: "disconnected",
  connected: false,
  address: null,
  chainId: null,
  source: null,
};

let currentWalletState = disconnectedWalletState;
let activeProvider: BrowserWalletProvider | null = null;
let activeProviderSource: WalletSource | null = null;
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
  activeProviderSource = null;
  activeAccountsChangedListener = null;
  activeChainChangedListener = null;
}

function bindProviderEvents(source: WalletSource, provider: BrowserWalletProvider) {
  if (
    activeProvider === provider &&
    activeProviderSource === source &&
    activeAccountsChangedListener &&
    activeChainChangedListener
  ) {
    return;
  }

  unbindProviderEvents();

  activeProvider = provider;
  activeProviderSource = source;
  activeAccountsChangedListener = (accounts: unknown) => {
    if (activeProvider !== provider || activeProviderSource !== source) {
      return;
    }

    const nextAddress = firstAddress(accounts);

    if (!nextAddress) {
      resetArcWallet(source);
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
    if (activeProvider !== provider || activeProviderSource !== source) {
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

export function getActiveArcWalletSource() {
  return activeProviderSource;
}

export async function syncArcWallet({
  source,
  address,
  chainId,
  provider,
}: ArcWalletSyncInput) {
  if (currentWalletState.source && currentWalletState.source !== source) {
    return;
  }

  const syncToken = ++activeSyncToken;
  let nextChainId = parseChainId(chainId);

  nextChainId = (await readProviderChainId(provider)) ?? nextChainId;

  if (
    syncToken !== activeSyncToken ||
    (currentWalletState.source && currentWalletState.source !== source)
  ) {
    return;
  }

  bindProviderEvents(source, provider);
  setWalletState({
    connected: true,
    status: "connected",
    address,
    chainId: nextChainId,
    source,
  });
}

export function syncArcWalletFromAppKit(input: AppKitWalletSyncInput) {
  return syncArcWallet({
    ...input,
    source: "appkit",
  });
}

export function resetArcWallet(source: WalletSource) {
  if (
    currentWalletState.source !== source &&
    activeProviderSource !== source
  ) {
    return;
  }

  activeSyncToken += 1;
  unbindProviderEvents();
  setDisconnectedWalletState();
}

export function resetArcWalletFromAppKit() {
  resetArcWallet("appkit");
}

export function connectArcWallet(
  _providerId?: string
): Promise<ArcWalletConnectResult> {
  void _providerId;

  return Promise.resolve({
    ok: false,
    error: new Error("Open the Reown AppKit login modal."),
  });
}

export function disconnectArcWallet(source?: WalletSource) {
  if (source) {
    resetArcWallet(source);
    return;
  }

  if (currentWalletState.source) {
    resetArcWallet(currentWalletState.source);
  }
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
