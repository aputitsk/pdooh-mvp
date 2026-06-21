"use client";

import { useEffect, useState } from "react";
import {
  connectWallet,
  formatWalletAddress,
  getWalletState,
  logOutWallet,
} from "@/lib/wallet/mockWallet";
import { subscribeToWalletChanges } from "@/lib/wallet/walletEvents";
import type { WalletState } from "@/lib/wallet/walletTypes";

const initialWalletState: WalletState = {
  connected: false,
  address: null,
};

export default function WalletButton() {
  const [wallet, setWallet] = useState<WalletState>(initialWalletState);

  useEffect(() => {
    setWallet(getWalletState());

    const unsubscribe = subscribeToWalletChanges(() => {
      setWallet(getWalletState());
    });

    return unsubscribe;
  }, []);

  function handleConnect() {
    connectWallet();
    setWallet(getWalletState());
  }

  function handleLogOut() {
    logOutWallet();
    setWallet(getWalletState());
  }

  if (!wallet.connected) {
    return (
      <button
        type="button"
        onClick={handleConnect}
        className="ml-2 rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white"
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="ml-2 flex items-center gap-2">
      <button
        type="button"
        className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/40"
      >
        {wallet.address ? formatWalletAddress(wallet.address) : "Wallet"}
      </button>

      <button
        type="button"
        onClick={handleLogOut}
        title="Log Out"
        className="rounded-full border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition hover:border-red-400 hover:text-red-300"
      >
        ⎋
      </button>
    </div>
  );
}