"use client";

import { useAppKit, useDisconnect } from "@reown/appkit/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { getArcScanAddressUrl } from "@/lib/arc/arcScanUrls";
import { isArcAppKitConfigured } from "@/lib/arc/arcAppKitConfig";
import {
  clearArcNetworkConnectionAttempt,
  markArcNetworkConnectionAttempt,
} from "@/lib/wallet/arcNetworkSwitchState";
import {
  clearWalletFlowNotice,
  getWalletFlowNotice,
  subscribeToWalletFlowNotice,
} from "@/lib/wallet/walletFlowNoticeState";
import {
  formatWalletAddress,
  getWalletState,
  logOutWallet,
  subscribeToWalletChanges,
  type WalletState,
} from "@/lib/wallet";
import CopyButton from "@/components/ui/CopyButton";
import ExternalLinkButton from "@/components/ui/ExternalLinkButton";
import ArcNetworkSwitchButton from "@/components/wallet/ArcNetworkSwitchButton";

const disconnectedWallet: WalletState = {
  status: "disconnected",
  connected: false,
  address: null,
  chainId: null,
};

let cachedWallet = disconnectedWallet;

function getWalletSnapshot() {
  const nextWallet = getWalletState();

  if (
    cachedWallet.connected === nextWallet.connected &&
    cachedWallet.address === nextWallet.address &&
    cachedWallet.status === nextWallet.status &&
    cachedWallet.chainId === nextWallet.chainId
  ) {
    return cachedWallet;
  }

  cachedWallet = nextWallet;
  return cachedWallet;
}

function getServerWalletSnapshot() {
  return disconnectedWallet;
}

function getServerWalletFlowNotice() {
  return null;
}

function WalletProjectMissingButton() {
  return (
    <button
      type="button"
      disabled
      title="Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable wallet connection."
      className="rounded-full bg-zinc-400 px-4 py-2 text-sm font-semibold text-black"
    >
      Connect wallet
    </button>
  );
}

function ConnectedWalletMenu({
  wallet,
  onDisconnect,
}: {
  wallet: WalletState;
  onDisconnect: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCopyNoticeVisible, setIsCopyNoticeVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const copyNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
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

  if (!wallet.address) {
    return null;
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsMenuOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900"
      >
        <span className="font-mono">{formatWalletAddress(wallet.address)}</span>
        <span className="text-xs text-zinc-400">
          {isMenuOpen ? "^" : "v"}
        </span>
      </button>

      {isMenuOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
            <span className="font-mono text-sm font-semibold text-zinc-100">
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
            onClick={() => {
              onDisconnect();
              setIsMenuOpen(false);
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-400 transition hover:bg-zinc-900"
          >
            <span className="text-base leading-none">x</span>
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

function AppKitWalletButton() {
  const [connectError, setConnectError] = useState<string | null>(null);
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();

  const wallet = useSyncExternalStore(
    subscribeToWalletChanges,
    getWalletSnapshot,
    getServerWalletSnapshot
  );
  const walletFlowNotice = useSyncExternalStore(
    subscribeToWalletFlowNotice,
    getWalletFlowNotice,
    getServerWalletFlowNotice
  );

  useEffect(() => {
    if (!walletFlowNotice) {
      return;
    }

    const timeoutId = setTimeout(() => {
      clearWalletFlowNotice();
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [walletFlowNotice]);

  function handleConnectClick() {
    setConnectError(null);
    clearWalletFlowNotice();
    markArcNetworkConnectionAttempt();

    void Promise.resolve()
      .then(() => open({ view: "Connect" }))
      .catch((error: unknown) => {
        clearArcNetworkConnectionAttempt();
        setConnectError(
          error instanceof Error ? error.message : "Wallet connection failed"
        );
      });
  }

  function handleDisconnect() {
    setConnectError(null);

    void disconnect({ namespace: "eip155" }).finally(() => {
      logOutWallet();
    });
  }

  if (wallet.connected && wallet.address) {
    return (
      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
        <ArcNetworkSwitchButton variant="compact" />
        <ConnectedWalletMenu wallet={wallet} onDisconnect={handleDisconnect} />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleConnectClick}
        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
      >
        Connect wallet
      </button>

      {connectError ? (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-red-500/30 bg-zinc-950 px-4 py-3 text-sm font-medium text-red-300 shadow-xl shadow-black/40">
          {connectError}
        </div>
      ) : null}

      {!connectError && walletFlowNotice ? (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-yellow-400/25 bg-zinc-950 px-4 py-3 text-sm font-medium text-yellow-200 shadow-xl shadow-black/40">
          {walletFlowNotice}
        </div>
      ) : null}
    </div>
  );
}

export default function WalletButton() {
  if (!isArcAppKitConfigured()) {
    return <WalletProjectMissingButton />;
  }

  return <AppKitWalletButton />;
}
