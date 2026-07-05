import { createPublicClient, formatUnits, http, type Chain } from "viem";

import {
  ARC_CHAIN_ID,
  ARC_CHAIN_NAME,
  ARC_EXPLORER_URL,
  ARC_NATIVE_CURRENCY_SYMBOL,
  ARC_RPC_URL,
} from "./arcConstants";

type ArcFeeSignalStatus = "idle" | "loading" | "ready" | "error";

export type ArcFeeSignalSnapshot = {
  display: string | null;
  status: ArcFeeSignalStatus;
};

const arcTestnetChain = {
  id: ARC_CHAIN_ID,
  name: ARC_CHAIN_NAME,
  nativeCurrency: {
    name: ARC_NATIVE_CURRENCY_SYMBOL,
    symbol: ARC_NATIVE_CURRENCY_SYMBOL,
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [ARC_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: ARC_EXPLORER_URL,
    },
  },
  testnet: true,
} as const satisfies Chain;

const arcPublicClient = createPublicClient({
  chain: arcTestnetChain,
  transport: http(ARC_RPC_URL),
});

const baselineGasUnits = BigInt(21_000);
const readyDisplayFractionDigits = 6;
const idleSnapshot: ArcFeeSignalSnapshot = {
  display: null,
  status: "idle",
};

let currentSnapshot = idleSnapshot;
const listeners = new Set<() => void>();

function emitFeeSignalChanged() {
  listeners.forEach((listener) => listener());
}

function setFeeSignalSnapshot(nextSnapshot: ArcFeeSignalSnapshot) {
  currentSnapshot = nextSnapshot;
  emitFeeSignalChanged();
}

function formatNativeUsdcFee(value: bigint) {
  const formattedValue = formatUnits(value, 18);
  const [wholePart, fractionPart = ""] = formattedValue.split(".");
  const visibleFraction = fractionPart
    .slice(0, readyDisplayFractionDigits)
    .replace(/0+$/, "");

  if (visibleFraction.length > 0) {
    return `\u2248 ${wholePart}.${visibleFraction} USDC`;
  }

  if (value > BigInt(0) && wholePart === "0") {
    return "\u2248 <0.000001 USDC";
  }

  return `\u2248 ${wholePart} USDC`;
}

export function getArcFeeSignalSnapshot() {
  return currentSnapshot;
}

export function getServerArcFeeSignalSnapshot() {
  return idleSnapshot;
}

export function subscribeToArcFeeSignal(onStoreChange: () => void) {
  listeners.add(onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
  };
}

export function refreshArcFeeSignal() {
  if (currentSnapshot.status === "idle") {
    setFeeSignalSnapshot({
      display: null,
      status: "loading",
    });
  }

  return arcPublicClient
    .getGasPrice()
    .then((gasPrice) => {
      setFeeSignalSnapshot({
        display: formatNativeUsdcFee(gasPrice * baselineGasUnits),
        status: "ready",
      });
    })
    .catch(() => {
      setFeeSignalSnapshot({
        display: null,
        status: "error",
      });
    });
}
