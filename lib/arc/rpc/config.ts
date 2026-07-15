export const ARC_OFFICIAL_RPC_URLS = [
  "https://rpc.testnet.arc.network",
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
] as const;

const ARC_DEFAULT_RPC_PRIORITY = [
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
  "https://rpc.testnet.arc.network",
] as const;

export const ARC_DEFAULT_RPC_PRIMARY =
  "https://rpc.drpc.testnet.arc.network";
export const ARC_RPC_TIMEOUT_MS = 4_000;
export const ARC_RPC_RETRY_COUNT = 0;

type ArcOfficialRpcUrl = (typeof ARC_OFFICIAL_RPC_URLS)[number];

const officialRpcUrlSet = new Set<string>(ARC_OFFICIAL_RPC_URLS);

function normalizeRpcUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function assertOfficialRpcUrl(
  value: string,
  envName: string
): ArcOfficialRpcUrl {
  const normalizedValue = normalizeRpcUrl(value);

  if (!officialRpcUrlSet.has(normalizedValue)) {
    throw new Error(
      `${envName} must be one of the official Arc Testnet RPC endpoints.`
    );
  }

  return normalizedValue as ArcOfficialRpcUrl;
}

function dedupeRpcUrls(urls: readonly string[]) {
  const seenUrls = new Set<string>();
  const dedupedUrls: ArcOfficialRpcUrl[] = [];

  for (const url of urls) {
    const officialUrl = assertOfficialRpcUrl(url, "Arc RPC URL");

    if (seenUrls.has(officialUrl)) {
      continue;
    }

    seenUrls.add(officialUrl);
    dedupedUrls.push(officialUrl);
  }

  return dedupedUrls;
}

export function getBrowserArcRpcPrimaryUrl() {
  const value = process.env.NEXT_PUBLIC_ARC_RPC_PRIMARY?.trim();

  if (!value) {
    return assertOfficialRpcUrl(
      ARC_DEFAULT_RPC_PRIMARY,
      "NEXT_PUBLIC_ARC_RPC_PRIMARY"
    );
  }

  return assertOfficialRpcUrl(value, "NEXT_PUBLIC_ARC_RPC_PRIMARY");
}

export function getServerArcRpcPrimaryUrl() {
  const value = process.env.ARC_RPC_PRIMARY?.trim();

  if (value) {
    return assertOfficialRpcUrl(value, "ARC_RPC_PRIMARY");
  }

  return getBrowserArcRpcPrimaryUrl();
}

export function getArcRpcFallbackUrls(primaryUrl = getBrowserArcRpcPrimaryUrl()) {
  return dedupeRpcUrls([primaryUrl, ...ARC_DEFAULT_RPC_PRIORITY]);
}

export function getServerArcRpcFallbackUrls(
  primaryUrl = getServerArcRpcPrimaryUrl()
) {
  return dedupeRpcUrls([primaryUrl, ...ARC_DEFAULT_RPC_PRIORITY]);
}

export const ARC_NETWORK_METADATA_RPC_URLS = getArcRpcFallbackUrls();
export const ARC_NETWORK_METADATA_PRIMARY_RPC_URL =
  ARC_NETWORK_METADATA_RPC_URLS[0] ?? ARC_DEFAULT_RPC_PRIMARY;
