"use client";

import {
  connectWallet,
  formatWalletAddress,
  getWalletProviders,
  getWalletState,
  logOutWallet,
  subscribeToWalletChanges,
  type WalletProviderOption,
  type WalletState,
} from "@/lib/wallet";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const restoringWallet: WalletState = {
  status: "restoring",
  connected: false,
  address: null,
};

let cachedWallet = restoringWallet;

function getWalletSnapshot() {
  const nextWallet = getWalletState();

  if (
    cachedWallet.connected === nextWallet.connected &&
    cachedWallet.address === nextWallet.address &&
    cachedWallet.status === nextWallet.status
  ) {
    return cachedWallet;
  }

  cachedWallet = nextWallet;
  return cachedWallet;
}

function getServerWalletSnapshot() {
  return restoringWallet;
}

function subscribeToHydration(onStoreChange: () => void) {
  queueMicrotask(onStoreChange);

  return () => {};
}

function getHydratedSnapshot() {
  return true;
}

function getServerHydratedSnapshot() {
  return false;
}

export default function WalletButton() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [walletProviders, setWalletProviders] = useState<
    WalletProviderOption[]
  >([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isMounted = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot
  );
  const wallet = useSyncExternalStore(
    subscribeToWalletChanges,
    getWalletSnapshot,
    getServerWalletSnapshot
  );

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [isMenuOpen]);

  function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Wallet connection failed";
  }

  async function connectSelectedWallet(providerId?: string) {
    setConnectError(null);
    await connectWallet(providerId);
    setWalletProviders([]);
    setIsMenuOpen(false);
  }

  async function handleConnectClick() {
    setConnectError(null);

    try {
      const providers = await getWalletProviders();

      if (providers.length === 0) {
        setWalletProviders([]);
        setConnectError("No browser wallet found");
        setIsMenuOpen(true);
        return;
      }

      setWalletProviders(providers);
      setIsMenuOpen(true);
    } catch (error) {
      setConnectError(getErrorMessage(error));
      setIsMenuOpen(true);
    }
  }

  async function handleProviderSelect(providerId: string) {
    try {
      await connectSelectedWallet(providerId);
    } catch (error) {
      setConnectError(getErrorMessage(error));
    }
  }

  async function handleCopyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    setIsMenuOpen(false);
  }

  function handleDisconnect() {
    logOutWallet();
    setIsMenuOpen(false);
    setWalletProviders([]);
    setConnectError(null);
  }

  if (!isMounted || wallet.status === "restoring") {
    return (
      <div className="h-9 w-[132px] rounded-full border border-zinc-800 bg-zinc-900/60" />
    );
  }

  if (wallet.connected && wallet.address) {
    return (
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setIsMenuOpen((current) => !current)}
          className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900"
        >
          <span>{formatWalletAddress(wallet.address)}</span>
          <span className="text-xs text-zinc-400">{isMenuOpen ? "⌃" : "⌄"}</span>
        </button>

        {isMenuOpen ? (
          <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/40">
            <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-100">
              {formatWalletAddress(wallet.address)}
            </div>

            <button
              type="button"
              onClick={() => void (wallet.address && handleCopyAddress(wallet.address))}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-zinc-100 transition hover:bg-zinc-900"
            >
              <span>Copy address</span>
            </button>

            <button
              type="button"
              onClick={handleDisconnect}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-400 transition hover:bg-zinc-900"
            >
              <span>⏻</span>
              <span>Disconnect</span>
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => void handleConnectClick()}
        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
      >
        Connect wallet
      </button>

      {isMenuOpen && (walletProviders.length > 0 || connectError) ? (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/40">
          {walletProviders.length > 0 ? (
            walletProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => void handleProviderSelect(provider.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-zinc-100 transition hover:bg-zinc-900"
              >
                {provider.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={provider.icon}
                    alt=""
                    className="h-5 w-5 rounded-full"
                  />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-zinc-800" />
                )}
                <span className="min-w-0 truncate">{provider.name}</span>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm font-medium text-red-400">
              {connectError}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
