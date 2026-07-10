"use client";

let walletFlowNotice: string | null = null;
const walletFlowNoticeListeners = new Set<() => void>();

function emitWalletFlowNoticeChanged() {
  walletFlowNoticeListeners.forEach((listener) => listener());
}

export function getWalletFlowNotice() {
  return walletFlowNotice;
}

export function setWalletFlowNotice(message: string) {
  walletFlowNotice = message;
  emitWalletFlowNoticeChanged();
}

export function clearWalletFlowNotice() {
  walletFlowNotice = null;
  emitWalletFlowNoticeChanged();
}

export function subscribeToWalletFlowNotice(listener: () => void) {
  walletFlowNoticeListeners.add(listener);

  return () => {
    walletFlowNoticeListeners.delete(listener);
  };
}
