import { createPublicClient } from "viem";

import { arcTestnetChain } from "./chain";
import { createBrowserArcFallbackTransport } from "./transport";

export function createArcPublicClient() {
  return createPublicClient({
    chain: arcTestnetChain,
    transport: createBrowserArcFallbackTransport(),
  });
}

export const arcPublicClient = createArcPublicClient();
