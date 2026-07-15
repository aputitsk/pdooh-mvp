import {
  createWalletClient,
  custom,
  isAddress,
  type Address,
} from "viem";

import type {
  BidAuthorizationPayload,
  SignedBidAuthorization,
} from "@/lib/auction/auctionTypes";
import {
  ARC_CHAIN_ID,
} from "./arcConstants";
import { arcTestnetChain } from "./rpc/chain";
import { createBidAuthorizationTypedData } from "./arcBidAuthorizationTypedData";
import {
  getActiveArcWalletProvider,
  getArcWalletState,
} from "./arcWalletAdapter";
import { normalizeWalletError } from "./arcWalletErrors";
import { parseChainId } from "./arcWalletNetwork";

function firstAddress(accounts: unknown): Address | null {
  const address = Array.isArray(accounts) ? accounts[0] : null;

  return typeof address === "string" && isAddress(address) ? address : null;
}

function isUserRejectedSignature(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const walletError = error as {
    code?: unknown;
    message?: unknown;
    shortMessage?: unknown;
  };
  const message = `${String(walletError.message ?? "")} ${String(
    walletError.shortMessage ?? ""
  )}`.toLowerCase();

  return (
    walletError.code === 4001 ||
    walletError.code === "4001" ||
    message.includes("user rejected") ||
    message.includes("user denied")
  );
}

function normalizeBidAuthorizationError(error: unknown) {
  if (isUserRejectedSignature(error)) {
    return new Error("Bid authorization signature was rejected.", {
      cause: error,
    });
  }

  return normalizeWalletError(error);
}

async function getBidAuthorizationContext(payload: BidAuthorizationPayload) {
  const wallet = getArcWalletState();
  const provider = getActiveArcWalletProvider();

  if (!wallet.connected || !wallet.address || !provider) {
    throw new Error("Log in with an external wallet before authorizing a bid.");
  }

  if (wallet.chainId !== ARC_CHAIN_ID) {
    throw new Error("Wallet must be connected to Arc Testnet.");
  }

  const [chainIdValue, accounts] = await Promise.all([
    provider.request({ method: "eth_chainId" }),
    provider.request({ method: "eth_accounts" }),
  ]);
  const activeAddress = firstAddress(accounts);

  if (parseChainId(chainIdValue) !== ARC_CHAIN_ID) {
    throw new Error("Wallet must be connected to Arc Testnet.");
  }

  if (
    !activeAddress ||
    activeAddress.toLowerCase() !== wallet.address.toLowerCase()
  ) {
    throw new Error("The active wallet account changed. Please try again.");
  }

  if (activeAddress.toLowerCase() !== payload.advertiserAddress.toLowerCase()) {
    throw new Error(
      "The active login address does not match the bid advertiser address."
    );
  }

  return {
    account: activeAddress,
    walletClient: createWalletClient({
      account: activeAddress,
      chain: arcTestnetChain,
      transport: custom(provider),
    }),
  };
}

export async function signArcBidAuthorization(
  payload: BidAuthorizationPayload
): Promise<SignedBidAuthorization> {
  const typedData = createBidAuthorizationTypedData(payload);
  const { account, walletClient } = await getBidAuthorizationContext(payload);

  try {
    const signature = await walletClient.signTypedData({
      ...typedData,
      account,
    });

    return {
      payload: { ...payload },
      signature,
    };
  } catch (error) {
    throw normalizeBidAuthorizationError(error);
  }
}
