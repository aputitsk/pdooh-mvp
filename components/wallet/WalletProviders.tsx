"use client";

import type { ReactNode } from "react";

import AppKitWalletProvider from "./AppKitWalletProvider";
import PrivyWalletProvider from "./PrivyWalletProvider";

export default function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <PrivyWalletProvider>
      <AppKitWalletProvider>{children}</AppKitWalletProvider>
    </PrivyWalletProvider>
  );
}
