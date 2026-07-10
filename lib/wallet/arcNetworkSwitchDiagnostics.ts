"use client";

import { ARC_CHAIN_ID } from "@/lib/arc/arcConstants";

export type ArcSwitchConnectorLike = {
  id?: string;
  name?: string;
  type?: string;
  uid?: string;
  getProvider?: () => Promise<unknown>;
};

export type ArcNetworkSwitchDiagnostics = {
  chainIdBefore: number | null;
  connectorId: string | null;
  connectorName: string | null;
  connectorType: string | null;
  connectorUid: string | null;
  isWalletConnect: boolean;
  sessionChainIds: number[] | null;
  sessionIncludesArc: boolean | null;
};

const ARC_SWITCH_TIMEOUT_MS = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getSessionChainIds(provider: unknown) {
  if (!isRecord(provider) || !isRecord(provider.session)) {
    return null;
  }

  const namespaces = provider.session.namespaces;

  if (!isRecord(namespaces) || !isRecord(namespaces.eip155)) {
    return null;
  }

  const eip155 = namespaces.eip155;
  const chainIds = new Set<number>();

  if (Array.isArray(eip155.chains)) {
    eip155.chains.forEach((chain) => {
      if (typeof chain !== "string") {
        return;
      }

      const [, chainId] = chain.split(":");
      const parsedChainId = Number.parseInt(chainId ?? "", 10);

      if (Number.isFinite(parsedChainId)) {
        chainIds.add(parsedChainId);
      }
    });
  }

  if (Array.isArray(eip155.accounts)) {
    eip155.accounts.forEach((account) => {
      if (typeof account !== "string") {
        return;
      }

      const [, chainId] = account.split(":");
      const parsedChainId = Number.parseInt(chainId ?? "", 10);

      if (Number.isFinite(parsedChainId)) {
        chainIds.add(parsedChainId);
      }
    });
  }

  return Array.from(chainIds);
}

export async function getArcNetworkSwitchDiagnostics({
  chainIdBefore,
  connector,
}: {
  chainIdBefore: number | null;
  connector?: ArcSwitchConnectorLike;
}): Promise<ArcNetworkSwitchDiagnostics> {
  const connectorId = getString(connector?.id);
  const connectorName = getString(connector?.name);
  const connectorType = getString(connector?.type);
  const connectorUid = getString(connector?.uid);
  const isWalletConnect =
    connectorId?.toLowerCase().includes("walletconnect") ||
    connectorName?.toLowerCase().includes("walletconnect") ||
    connectorType?.toLowerCase().includes("walletconnect") ||
    false;
  const provider = await connector?.getProvider?.().catch(() => null);
  const sessionChainIds = getSessionChainIds(provider);
  const sessionIncludesArc = sessionChainIds
    ? sessionChainIds.includes(ARC_CHAIN_ID)
    : null;

  return {
    chainIdBefore,
    connectorId,
    connectorName,
    connectorType,
    connectorUid,
    isWalletConnect,
    sessionChainIds,
    sessionIncludesArc,
  };
}

export function withArcSwitchTimeout<T>(promise: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          "Wallet opened, but Arc Testnet was not activated."
        )
      );
    }, ARC_SWITCH_TIMEOUT_MS);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}
