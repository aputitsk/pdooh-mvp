import {
  ARC_CHAIN_ID,
  ARC_CHAIN_NAME,
  ARC_EXPLORER_URL,
  ARC_NATIVE_CURRENCY_SYMBOL,
  ARC_RPC_URL,
} from "./arcConstants";
import type { BrowserWalletProvider } from "./arcWalletDiscovery";
import {
  isUnknownChainError,
  normalizeWalletError,
} from "./arcWalletErrors";

function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

export function parseChainId(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number.parseInt(value, value.startsWith("0x") ? 16 : 10);
  }

  return null;
}

export async function switchToArcTestnet(
  provider: BrowserWalletProvider
) {
  const arcChainId = toHexChainId(ARC_CHAIN_ID);
  const switchToArc = () =>
    provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: arcChainId }],
    });
  const addArc = () =>
    provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: arcChainId,
          chainName: ARC_CHAIN_NAME,
          nativeCurrency: {
            name: ARC_NATIVE_CURRENCY_SYMBOL,
            symbol: ARC_NATIVE_CURRENCY_SYMBOL,
            decimals: 18,
          },
          rpcUrls: [ARC_RPC_URL],
          blockExplorerUrls: [ARC_EXPLORER_URL],
        },
      ],
    });

  try {
    await switchToArc();
  } catch (error) {
    if (!isUnknownChainError(error)) {
      throw normalizeWalletError(error);
    }

    await addArc();
    await switchToArc();
  }
}

export async function getCurrentChainId(
  provider: BrowserWalletProvider
) {
  return parseChainId(await provider.request({ method: "eth_chainId" }));
}
