"use client";

import { useState, useSyncExternalStore } from "react";
import { useSwitchChain } from "wagmi";

import { ARC_CHAIN_ID } from "@/lib/arc/arcConstants";
import { arcAppKitNetwork } from "@/lib/arc/arcAppKitConfig";
import {
  clearArcNetworkSwitchState,
  getArcNetworkSwitchState,
  setArcNetworkSwitchError,
  setArcNetworkSwitching,
  subscribeToArcNetworkSwitchState,
} from "@/lib/wallet/arcNetworkSwitchState";
import {
  getWalletState,
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
  const { switchChainAsync } = useSwitchChain();
  const [localError, setLocalError] = useState<string | null>(null);
  const isWrongNetwork =
    wallet.connected &&
    wallet.address &&
    wallet.chainId !== null &&
    wallet.chainId !== ARC_CHAIN_ID;

  if (!isWrongNetwork) {
    return null;
  }

  const isSwitching = networkSwitch.status === "switching";
  const message =
    localError ??
    networkSwitch.message ??
    "External wallet is not on Arc network.";

  async function handleSwitchToArc() {
    setLocalError(null);
    setArcNetworkSwitching();

    try {
      await switchChainAsync({ chainId: arcAppKitNetwork.id });
      clearArcNetworkSwitchState();
    } catch (error) {
      setArcNetworkSwitchError(error);
      setLocalError(getArcNetworkSwitchState().message);
    }
  }

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1.5 text-xs font-semibold text-yellow-100">
        <span className="hidden max-w-48 truncate sm:inline">{message}</span>
        <button
          type="button"
          onClick={() => void handleSwitchToArc()}
          disabled={isSwitching}
          className="rounded-full bg-yellow-200 px-3 py-1 text-xs font-bold text-zinc-950 transition hover:bg-yellow-100 disabled:cursor-wait disabled:opacity-70"
        >
          {isSwitching ? "Switching..." : "Switch to Arc"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-yellow-400/25 bg-yellow-400/10 p-4 text-sm text-yellow-100">
      <p className="font-semibold">{message}</p>
      <button
        type="button"
        onClick={() => void handleSwitchToArc()}
        disabled={isSwitching}
        className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full bg-yellow-200 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-100 disabled:cursor-wait disabled:opacity-70"
      >
        {isSwitching ? "Waiting for wallet..." : "Switch to Arc Testnet"}
      </button>
    </div>
  );
}
