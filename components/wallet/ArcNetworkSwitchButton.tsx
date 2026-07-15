"use client";

import { useAppKit, useDisconnect } from "@reown/appkit/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";

import { arcAppKitNetwork } from "@/lib/arc/arcAppKitConfig";
import {
  ARC_CHAIN_ID,
  ARC_CHAIN_NAME,
  ARC_EXPLORER_URL,
  ARC_NATIVE_CURRENCY_SYMBOL,
} from "@/lib/arc/arcConstants";
import { ARC_NETWORK_METADATA_RPC_URLS } from "@/lib/arc/rpc/config";
import { getActiveArcWalletProvider } from "@/lib/arc/arcWalletAdapter";
import {
  clearArcNetworkSwitchState,
  getArcNetworkSwitchState,
  markArcNetworkConnectionAttempt,
  setArcNetworkSwitchError,
  setArcNetworkSwitching,
  subscribeToArcNetworkSwitchState,
} from "@/lib/wallet/arcNetworkSwitchState";
import {
  getArcNetworkSwitchDiagnostics,
  withArcSwitchTimeout,
} from "@/lib/wallet/arcNetworkSwitchDiagnostics";
import {
  getWalletState,
  logOutWallet,
  subscribeToWalletChanges,
  type WalletState,
} from "@/lib/wallet";

type ArcNetworkSwitchButtonProps = {
  variant?: "card" | "compact";
};

type NetworkSwitchActionProps = ArcNetworkSwitchButtonProps & {
  isSwitching: boolean;
  message: string;
  onAction: () => void;
  onDisconnect?: () => void;
  requiresReconnect?: boolean;
};

const disconnectedWallet: WalletState = {
  status: "disconnected",
  connected: false,
  address: null,
  chainId: null,
  source: null,
};

function getServerWalletSnapshot() {
  return disconnectedWallet;
}

function NetworkSwitchAction({
  isSwitching,
  message,
  onAction,
  onDisconnect,
  requiresReconnect = false,
  variant = "card",
}: NetworkSwitchActionProps) {
  const compactLabel = requiresReconnect
    ? "Login again"
    : isSwitching
      ? "Switching..."
      : "Switch to Arc";
  const cardLabel = requiresReconnect
    ? "Login again"
    : isSwitching
      ? "Waiting for wallet..."
      : "Switch to Arc Testnet";

  if (variant === "compact") {
    return (
      <div className="flex max-w-full flex-wrap items-center justify-end gap-2 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1.5 text-xs font-semibold text-yellow-100">
        <span className="hidden max-w-48 truncate sm:inline">{message}</span>
        <button
          type="button"
          onClick={() => void onAction()}
          disabled={isSwitching}
          className="whitespace-nowrap rounded-full bg-yellow-200 px-3 py-1 text-xs font-bold text-zinc-950 transition hover:bg-yellow-100 disabled:cursor-wait disabled:opacity-70"
        >
          {compactLabel}
        </button>
        {requiresReconnect && onDisconnect ? (
          <button
            type="button"
            onClick={() => void onDisconnect()}
            className="whitespace-nowrap rounded-full border border-yellow-100/25 px-3 py-1 text-xs font-bold text-yellow-100 transition hover:bg-yellow-100/10"
          >
            Logout
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-yellow-400/25 bg-yellow-400/10 p-4 text-sm text-yellow-100">
      <p className="whitespace-pre-line font-semibold">{message}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void onAction()}
          disabled={isSwitching}
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-yellow-200 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-100 disabled:cursor-wait disabled:opacity-70"
        >
          {cardLabel}
        </button>
        {requiresReconnect && onDisconnect ? (
          <button
            type="button"
            onClick={() => void onDisconnect()}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-yellow-100/25 px-4 py-2 text-sm font-bold text-yellow-100 transition hover:bg-yellow-100/10"
          >
            Logout
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AppKitArcNetworkSwitchButton({
  variant = "card",
}: ArcNetworkSwitchButtonProps) {
  const networkSwitch = useSyncExternalStore(
    subscribeToArcNetworkSwitchState,
    getArcNetworkSwitchState,
    getArcNetworkSwitchState
  );
  const account = useAccount();
  const chainId = useChainId();
  const chainIdRef = useRef(chainId);
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const isSwitching = networkSwitch.status === "switching";
  const requiresReconnect = networkSwitch.status === "reconnect_required";
  const message =
    networkSwitch.message ?? "External wallet is not on Arc network.";

  useEffect(() => {
    chainIdRef.current = chainId;
  }, [chainId]);

  useEffect(() => {
    if (chainId === ARC_CHAIN_ID) {
      clearArcNetworkSwitchState();
    }
  }, [chainId]);

  async function handleSwitchToArc() {
    setArcNetworkSwitching();

    try {
      const diagnostics = await getArcNetworkSwitchDiagnostics({
        chainIdBefore: chainId,
        connector: account.connector,
      });

      if (!diagnostics.isWalletConnect) {
        await switchChainAsync({ chainId: arcAppKitNetwork.id });
        clearArcNetworkSwitchState();
        return;
      }

      if (diagnostics.sessionIncludesArc === false) {
        setArcNetworkSwitchError(
          new Error("Arc Testnet is not included in this WalletConnect session."),
          diagnostics
        );
        return;
      }

      await withArcSwitchTimeout(
        switchChainAsync({ chainId: arcAppKitNetwork.id })
      );

      if (chainIdRef.current === arcAppKitNetwork.id) {
        clearArcNetworkSwitchState();
        return;
      }

      setArcNetworkSwitchError(
        new Error("Wallet opened, but Arc Testnet was not activated."),
        diagnostics
      );
    } catch (error) {
      const diagnostics = await getArcNetworkSwitchDiagnostics({
        chainIdBefore: chainId,
        connector: account.connector,
      });

      setArcNetworkSwitchError(error, diagnostics);
    }
  }

  async function handleReconnectWallet() {
    clearArcNetworkSwitchState();

    try {
      await disconnect({ namespace: "eip155" });
    } finally {
      logOutWallet("appkit");
    }

    markArcNetworkConnectionAttempt();
    await open({ view: "Connect" });
  }

  async function handleDisconnectWallet() {
    clearArcNetworkSwitchState();

    try {
      await disconnect({ namespace: "eip155" });
    } finally {
      logOutWallet("appkit");
    }
  }

  return (
    <NetworkSwitchAction
      isSwitching={isSwitching}
      message={message}
      onAction={requiresReconnect ? handleReconnectWallet : handleSwitchToArc}
      onDisconnect={requiresReconnect ? handleDisconnectWallet : undefined}
      requiresReconnect={requiresReconnect}
      variant={variant}
    />
  );
}

function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

function getPrivySwitchErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown };
    const message =
      typeof candidate.message === "string" ? candidate.message : null;

    if (candidate.code === 4001 || candidate.code === "4001") {
      return "Network switch was rejected.";
    }

    if (message) {
      return message;
    }
  }

  return "Email wallet could not switch to Arc Testnet.";
}

async function switchPrivyProviderToArc() {
  const provider = getActiveArcWalletProvider();

  if (!provider) {
    throw new Error("Email wallet provider is not ready.");
  }

  const chainId = toHexChainId(ARC_CHAIN_ID);

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
    return;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      ((error as { code?: unknown }).code === 4902 ||
        (error as { code?: unknown }).code === "4902")
    ) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: ARC_CHAIN_NAME,
            nativeCurrency: {
              decimals: 18,
              name: ARC_NATIVE_CURRENCY_SYMBOL,
              symbol: ARC_NATIVE_CURRENCY_SYMBOL,
            },
            rpcUrls: ARC_NETWORK_METADATA_RPC_URLS,
            blockExplorerUrls: [ARC_EXPLORER_URL],
          },
        ],
      });
      return;
    }

    throw error;
  }
}

function PrivyArcNetworkSwitchButton({
  variant = "card",
}: ArcNetworkSwitchButtonProps) {
  const networkSwitch = useSyncExternalStore(
    subscribeToArcNetworkSwitchState,
    getArcNetworkSwitchState,
    getArcNetworkSwitchState
  );
  const isSwitching = networkSwitch.status === "switching";
  const message =
    networkSwitch.message ?? "Email wallet is not on Arc network.";

  async function handleSwitchToArc() {
    setArcNetworkSwitching();

    try {
      await switchPrivyProviderToArc();
      clearArcNetworkSwitchState();
    } catch (error) {
      setArcNetworkSwitchError(
        new Error(getPrivySwitchErrorMessage(error), { cause: error })
      );
    }
  }

  return (
    <NetworkSwitchAction
      isSwitching={isSwitching}
      message={message}
      onAction={handleSwitchToArc}
      variant={variant}
    />
  );
}

export default function ArcNetworkSwitchButton({
  variant = "card",
}: ArcNetworkSwitchButtonProps) {
  const wallet = useSyncExternalStore(
    subscribeToWalletChanges,
    getWalletState,
    getServerWalletSnapshot
  );
  const isWrongNetwork =
    wallet.connected &&
    wallet.address &&
    wallet.chainId !== null &&
    wallet.chainId !== ARC_CHAIN_ID;

  if (!isWrongNetwork) {
    return null;
  }

  if (wallet.source === "privy") {
    return <PrivyArcNetworkSwitchButton variant={variant} />;
  }

  if (wallet.source === "appkit") {
    return <AppKitArcNetworkSwitchButton variant={variant} />;
  }

  return null;
}
