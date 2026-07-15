import { fallback, http } from "viem";

import {
  ARC_RPC_RETRY_COUNT,
  ARC_RPC_TIMEOUT_MS,
  getArcRpcFallbackUrls,
  getBrowserArcRpcPrimaryUrl,
} from "./config";

export function createArcFallbackTransport(
  rpcUrls: readonly string[] = getArcRpcFallbackUrls()
) {
  return fallback(
    rpcUrls.map((url) =>
      http(url, {
        retryCount: ARC_RPC_RETRY_COUNT,
        timeout: ARC_RPC_TIMEOUT_MS,
      })
    ),
    {
      rank: false,
      retryCount: ARC_RPC_RETRY_COUNT,
    }
  );
}

export function createBrowserArcFallbackTransport() {
  return createArcFallbackTransport(
    getArcRpcFallbackUrls(getBrowserArcRpcPrimaryUrl())
  );
}
