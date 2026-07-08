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
import { getArcScanAddressUrl } from "@/lib/arc/arcScanUrls";
import CopyButton from "@/components/ui/CopyButton";
import ExternalLinkButton from "@/components/ui/ExternalLinkButton";
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

function getWalletErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const walletError = error as {
    code?: unknown;
    cause?: unknown;
  };

  if (walletError.code !== undefined) {
    return String(walletError.code);
  }

  return getWalletErrorCode(walletError.cause);
}

function isUserRejectedWalletRequest(error: unknown) {
  if (getWalletErrorCode(error) === "4001") {
    return true;
  }

  if (error instanceof Error) {
    return error.message.includes("code: 4001");
  }

  return false;
}

export default function WalletButton() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCopyNoticeVisible, setIsCopyNoticeVisible] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [walletProviders, setWalletProviders] = useState<
    WalletProviderOption[]
  >([]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isConnectingRef = useRef(false);
  const copyNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

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

  useEffect(() => {
    return () => {
      if (copyNoticeTimeoutRef.current) {
        clearTimeout(copyNoticeTimeoutRef.current);
      }
    };
  }, []);

  function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Wallet connection failed";
  }

  function handleConnectionError(error: unknown) {
    if (isUserRejectedWalletRequest(error)) {
      setConnectError(null);
      setIsMenuOpen(false);
      return;
    }

    setConnectError(getErrorMessage(error));
    setIsMenuOpen(true);
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
      handleConnectionError(error);
    }
  }

  function handleProviderSelect(providerId: string | null) {
    if (!providerId || isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;
    setIsConnecting(true);
    setConnectError(null);

    void connectWallet(providerId)
      .then((result) => {
        if (result.ok) {
          setWalletProviders([]);
          setIsMenuOpen(false);
          return;
        }

        handleConnectionError(result.error);
      })
      .catch((error: unknown) => {
        handleConnectionError(error);
      })
      .finally(() => {
        isConnectingRef.current = false;
        setIsConnecting(false);
      });
  }

  async function handleCopyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    setIsMenuOpen(false);
    setIsCopyNoticeVisible(true);

    if (copyNoticeTimeoutRef.current) {
      clearTimeout(copyNoticeTimeoutRef.current);
    }

    copyNoticeTimeoutRef.current = setTimeout(() => {
      setIsCopyNoticeVisible(false);
    }, 1800);
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
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
              <span className="text-sm font-semibold text-zinc-100">
                {formatWalletAddress(wallet.address)}
              </span>
              <div className="flex items-center gap-1">
                <CopyButton
                  ariaLabel="Copy wallet address"
                  onClick={() =>
                    void (wallet.address && handleCopyAddress(wallet.address))
                  }
                  className="rounded-full p-1.5 text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
                  iconClassName="h-4 w-4"
                />
                <ExternalLinkButton
                  href={getArcScanAddressUrl(wallet.address)}
                  ariaLabel="View wallet address on ArcScan"
                  className="rounded-full p-1.5 text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
                  iconClassName="h-4 w-4"
                />
              </div>
            </div>

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

        {isCopyNoticeVisible ? (
          <div
            role="status"
            aria-live="polite"
            className="absolute right-0 z-50 mt-2 whitespace-nowrap rounded-full border border-emerald-300/20 bg-zinc-950 px-3 py-2 text-xs font-semibold text-emerald-200 shadow-xl shadow-black/40"
          >
            Address copied
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        disabled={isConnecting}
        onClick={() => void handleConnectClick()}
        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {isConnecting ? "Connecting..." : "Connect wallet"}
      </button>

      {isMenuOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/40">
          {walletProviders.length > 0 ? (
            walletProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                disabled={
                  isConnecting || !provider.installed || !provider.providerId
                }
                onClick={() => handleProviderSelect(provider.providerId)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-zinc-100 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-500 disabled:hover:bg-zinc-950"
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
                <span className="min-w-0 flex-1 truncate">
                  {provider.name}
                </span>
                <span className="text-xs">
                  {provider.installed ? "Installed" : "Not installed"}
                </span>
              </button>
            ))
          ) : connectError ? (
            <div className="px-4 py-3 text-sm font-medium text-red-400">
              {connectError}
            </div>
          ) : null}

          {walletProviders.length > 0 && connectError ? (
            <div className="border-t border-zinc-800 px-4 py-3 text-sm font-medium text-red-400">
              {connectError}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
