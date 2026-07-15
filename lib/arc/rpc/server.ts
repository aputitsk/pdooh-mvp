import { createPublicClient, http } from "viem";

import { arcTestnetChain } from "./chain";
import {
  ARC_RPC_RETRY_COUNT,
  ARC_RPC_TIMEOUT_MS,
  getServerArcRpcFallbackUrls,
  getServerArcRpcPrimaryUrl,
} from "./config";
import { createArcFallbackTransport } from "./transport";

export function createServerArcFallbackTransport() {
  return createArcFallbackTransport(
    getServerArcRpcFallbackUrls(getServerArcRpcPrimaryUrl())
  );
}

export function createServerArcPreferredTransport() {
  return http(getServerArcRpcPrimaryUrl(), {
    retryCount: ARC_RPC_RETRY_COUNT,
    timeout: ARC_RPC_TIMEOUT_MS,
  });
}

export function createOperatorArcPublicClient() {
  return createPublicClient({
    chain: arcTestnetChain,
    transport: createServerArcFallbackTransport(),
  });
}

export function createOperatorArcBroadcastTransport() {
  return createServerArcPreferredTransport();
}
