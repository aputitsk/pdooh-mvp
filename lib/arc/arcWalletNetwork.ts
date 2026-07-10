import type { BrowserWalletProvider } from "./arcWalletDiscovery";

export function parseChainId(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number.parseInt(value, value.startsWith("0x") ? 16 : 10);
  }

  return null;
}

export async function getCurrentChainId(
  provider: BrowserWalletProvider
) {
  return parseChainId(await provider.request({ method: "eth_chainId" }));
}
