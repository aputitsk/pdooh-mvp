"use client";

import {
  connectWallet,
  formatWalletAddress,
  getWalletState,
  logOutWallet,
  subscribeToWalletChanges,
  type WalletState,
} from "@/lib/wallet";
import { useSyncExternalStore } from "react";

const disconnectedWallet: WalletState = {
  connected: false,
  address: null,
};

let cachedWallet = disconnectedWallet;

function getWalletSnapshot() {
  const nextWallet = getWalletState();

  if (
    cachedWallet.connected === nextWallet.connected &&
    cachedWallet.address === nextWallet.address
  ) {
    return cachedWallet;
  }

  cachedWallet = nextWallet;
  return cachedWallet;
}

function getServerWalletSnapshot() {
  return disconnectedWallet;
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

  if (!isMounted) {
    return (
      <div className="h-9 w-[132px] rounded-full border border-zinc-800 bg-zinc-900/60" />
    );
  }

  if (wallet.connected && wallet.address) {
    return (
      <button
        type="button"
        onClick={logOutWallet}
        className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900"
      >
        {formatWalletAddress(wallet.address)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={connectWallet}
      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
    >
      Connect wallet
    </button>
  );
}
