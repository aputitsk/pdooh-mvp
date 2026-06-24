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

  window.addEventListener("storage", callback);
  window.addEventListener(walletChangedEventName, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(walletChangedEventName, callback);
  };
}
