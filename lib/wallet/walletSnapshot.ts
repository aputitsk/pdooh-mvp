import type { WalletState } from "./walletTypes";

type WalletSnapshotValue = {
  status: WalletState["status"];
  connected: boolean;
  address: string | null;
  chainId: number | null;
  source: WalletState["source"];
};

const emptyWalletSnapshotValue: WalletSnapshotValue = {
  status: "disconnected",
  connected: false,
  address: null,
  chainId: null,
  source: null,
};

export const emptyWalletSnapshot = JSON.stringify(emptyWalletSnapshotValue);

function isWalletStatus(value: unknown): value is WalletState["status"] {
  return (
    value === "connected" ||
    value === "disconnected" ||
    value === "restoring"
  );
}

function isWalletSource(value: unknown): value is WalletState["source"] {
  return value === "appkit" || value === "privy" || value === null;
}

function toWalletSnapshotValue(value: unknown): WalletSnapshotValue {
  if (typeof value !== "object" || value === null) {
    return { ...emptyWalletSnapshotValue, status: "disconnected" };
  }

  const candidate = value as Partial<WalletSnapshotValue>;
  const status = isWalletStatus(candidate.status)
    ? candidate.status
    : "disconnected";

  return {
    status,
    connected: candidate.connected === true,
    address:
      typeof candidate.address === "string" && candidate.address.length > 0
        ? candidate.address
        : null,
    chainId:
      typeof candidate.chainId === "number" &&
      Number.isFinite(candidate.chainId)
        ? candidate.chainId
        : null,
    source: isWalletSource(candidate.source) ? candidate.source : null,
  };
}

export function createWalletSnapshot(wallet: WalletState) {
  return JSON.stringify({
    status: wallet.status,
    connected: wallet.connected,
    address: wallet.address ?? null,
    chainId: wallet.chainId ?? null,
    source: wallet.source ?? null,
  } satisfies WalletSnapshotValue);
}

export function getServerWalletSnapshot() {
  return emptyWalletSnapshot;
}

export function parseWalletSnapshot(snapshot: string): WalletState {
  try {
    return toWalletSnapshotValue(JSON.parse(snapshot));
  } catch {
    return { ...emptyWalletSnapshotValue, status: "disconnected" };
  }
}
