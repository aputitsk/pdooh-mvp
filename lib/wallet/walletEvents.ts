const walletChangedEventName = "pdooh-wallet-changed";

function isBrowser() {
  return typeof window !== "undefined";
}

export function notifyWalletChanged() {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new Event(walletChangedEventName));
}

export function subscribeToWalletChanges(callback: () => void) {
  if (!isBrowser()) {
    return () => {};
  }

  window.addEventListener(walletChangedEventName, callback);

  return () => {
    window.removeEventListener(walletChangedEventName, callback);
  };
}