import type { ArcWalletProviderOption } from "./arcWalletDiscovery";

const appDisconnectedSessionKey = "pdooh-wallet-app-disconnected";
const boundProviderSessionKey = "pdooh-wallet-bound-provider";

function isBrowser() {
  return typeof window !== "undefined";
}

export function isAppDisconnectLocked() {
  return (
    isBrowser() &&
    window.sessionStorage.getItem(appDisconnectedSessionKey) === "true"
  );
}

export function lockAppDisconnect() {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(appDisconnectedSessionKey, "true");
}

export function unlockAppDisconnect() {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(appDisconnectedSessionKey);
}

export function getStoredProviderBinding(): ArcWalletProviderOption | null {
  if (!isBrowser()) {
    return null;
  }

  const storedBinding = window.sessionStorage.getItem(boundProviderSessionKey);

  if (!storedBinding) {
    return null;
  }

  try {
    const binding = JSON.parse(storedBinding) as Partial<ArcWalletProviderOption>;

    if (typeof binding.id !== "string" || typeof binding.name !== "string") {
      return null;
    }

    return {
      id: binding.id,
      name: binding.name,
      icon: typeof binding.icon === "string" ? binding.icon : null,
      rdns: typeof binding.rdns === "string" ? binding.rdns : null,
    };
  } catch {
    return null;
  }
}

export function storeProviderBinding(provider: ArcWalletProviderOption) {
  if (!isBrowser()) {
    return;
  }

  const binding: ArcWalletProviderOption = {
    id: provider.id,
    name: provider.name,
    icon: provider.icon,
    rdns: provider.rdns,
  };

  window.sessionStorage.setItem(
    boundProviderSessionKey,
    JSON.stringify(binding)
  );
}

export function clearProviderBinding() {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(boundProviderSessionKey);
}
