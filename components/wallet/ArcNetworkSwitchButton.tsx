"use client";

import { useAppKit, useDisconnect } from "@reown/appkit/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";

import { ARC_CHAIN_ID } from "@/lib/arc/arcConstants";
import { arcAppKitNetwork } from "@/lib/arc/arcAppKitConfig";
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

const disconnectedWallet: WalletState = {
  status: "disconnected",
  connected: false,
  address: null,
  chainId: null,
};

function getServerWalletSnapshot() {
  return disconnectedWallet;
}

export default function ArcNetworkSwitchButton({
  variant = "card",
}: ArcNetworkSwitchButtonProps) {
  const wallet = useSyncExternalStore(
    subscribeToWalletChanges,
    getWalletState,
    getServerWalletSnapshot
  );
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
  const isWrongNetwork =
    wallet.connected &&
    wallet.address &&
    wallet.chainId !== null &&
    wallet.chainId !== ARC_CHAIN_ID;

  useEffect(() => {
    chainIdRef.current = chainId;
  }, [chainId]);

  useEffect(() => {
    if (chainId === ARC_CHAIN_ID) {
      clearArcNetworkSwitchState();
    }
  }, [chainId]);

  const isSwitching = networkSwitch.status === "switching";
  const requiresReconnect = networkSwitch.status === "reconnect_required";
  const message =
    networkSwitch.message ??
    "External wallet is not on Arc network.";

  if (!isWrongNetwork) {
    return null;
  }

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
      logOutWallet();
    }

    markArcNetworkConnectionAttempt();
    await open({ view: "Connect" });
  }

  async function handleDisconnectWallet() {
    clearArcNetworkSwitchState();

    try {
      await disconnect({ namespace: "eip155" });
    } finally {
      logOutWallet();
    }
  }

  const action = requiresReconnect ? handleReconnectWallet : handleSwitchToArc;
  const compactLabel = requiresReconnect
    ? "Reconnect wallet"
    : isSwitching
      ? "Switching..."
      : "Switch to Arc";
  const cardLabel = requiresReconnect
    ? "Reconnect wallet"
    : isSwitching
      ? "Waiting for wallet..."
      : "Switch to Arc Testnet";

  if (variant === "compact") {
    return (
      <div className="flex max-w-full flex-wrap items-center justify-end gap-2 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1.5 text-xs font-semibold text-yellow-100">
        <span className="hidden max-w-48 truncate sm:inline">{message}</span>
        <button
          type="button"
          onClick={() => void action()}
          disabled={isSwitching}
          className="whitespace-nowrap rounded-full bg-yellow-200 px-3 py-1 text-xs font-bold text-zinc-950 transition hover:bg-yellow-100 disabled:cursor-wait disabled:opacity-70"
        >
          {compactLabel}
        </button>
        {requiresReconnect ? (
          <button
            type="button"
            onClick={() => void handleDisconnectWallet()}
            className="whitespace-nowrap rounded-full border border-yellow-100/25 px-3 py-1 text-xs font-bold text-yellow-100 transition hover:bg-yellow-100/10"
          >
            Disconnect
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
          onClick={() => void action()}
          disabled={isSwitching}
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-yellow-200 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-100 disabled:cursor-wait disabled:opacity-70"
        >
          {cardLabel}
        </button>
        {requiresReconnect ? (
          <button
            type="button"
            onClick={() => void handleDisconnectWallet()}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-yellow-100/25 px-4 py-2 text-sm font-bold text-yellow-100 transition hover:bg-yellow-100/10"
          >
            Disconnect
          </button>
        ) : null}
      </div>
    </div>
  );
}
