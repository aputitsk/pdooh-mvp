import {
  createWalletClient,
  custom,
  getAddress,
  isAddress,
  type Address,
} from "viem";

import {
  ARC_CHAIN_ID,
  ARC_USDC_CONTRACT_ADDRESS,
} from "../../arcConstants";
import type { ContractV1AddressConfig } from "../config";
import { arcTestnetChain } from "../../rpc/chain";
import {
  getActiveArcWalletProvider,
  getArcWalletState,
} from "../../arcWalletAdapter";
import type {
  ContractV1PreWriteValidationInput,
  ContractV1WriteResult,
  ContractV1WalletWriteClient,
  ContractV1WalletWriteContext,
} from "./types";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { contractV1WriteFailure } from "./errors.ts";

export type ContractV1ActiveWalletWriteContext = {
  context: ContractV1WalletWriteContext;
  walletClient: ContractV1WalletWriteClient | null;
  preWriteValidator: (
    input: ContractV1PreWriteValidationInput
  ) => Promise<ContractV1WriteResult<void>>;
};

export async function getActiveContractV1WalletWriteContext({
  addressConfig,
  expectedChainId = ARC_CHAIN_ID,
  usdcAddress = ARC_USDC_CONTRACT_ADDRESS,
}: {
  addressConfig: ContractV1AddressConfig;
  expectedChainId?: number;
  usdcAddress?: Address;
}): Promise<ContractV1ActiveWalletWriteContext> {
  const wallet = getArcWalletState();
  const provider = getActiveArcWalletProvider();
  let chainId = wallet.chainId ?? null;
  let account = wallet.address && isAddress(wallet.address)
    ? getAddress(wallet.address)
    : null;
  let walletClient: ContractV1WalletWriteClient | null = null;

  if (wallet.connected && account && provider) {
    const [providerChainId, providerAccounts] = await Promise.all([
      provider.request({ method: "eth_chainId" }).catch(() => null),
      provider.request({ method: "eth_accounts" }).catch(() => null),
    ]);
    const activeAccount = firstAddress(providerAccounts);

    chainId = parseChainId(providerChainId) ?? chainId;

    if (activeAccount?.toLowerCase() === account.toLowerCase()) {
      walletClient = createWalletClient({
        account,
        chain: arcTestnetChain,
        transport: custom(provider),
      });
    } else {
      account = null;
    }
  }

  return {
    context: {
      mode: addressConfig.mode,
      configValid: addressConfig.valid,
      chainId,
      expectedChainId,
      account,
      escrowAddress: addressConfig.escrowAddress,
      usdcAddress,
    },
    walletClient,
    preWriteValidator: validateActiveContractV1WalletWriteSession,
  };
}

export async function validateActiveContractV1WalletWriteSession({
  account,
  expectedChainId,
}: ContractV1PreWriteValidationInput): Promise<ContractV1WriteResult<void>> {
  const provider = getActiveArcWalletProvider();

  if (!provider) {
    return contractV1WriteFailure({
      code: "wallet_disconnected",
      stage: "preflight",
      retryable: false,
    });
  }

  const [providerChainId, providerAccounts] = await Promise.all([
    provider.request({ method: "eth_chainId" }).catch(() => null),
    provider.request({ method: "eth_accounts" }).catch(() => null),
  ]);
  const activeChainId = parseChainId(providerChainId);
  const activeAccount = firstAddress(providerAccounts);

  if (activeChainId !== expectedChainId) {
    return contractV1WriteFailure({
      code: "wrong_chain",
      stage: "preflight",
      retryable: false,
    });
  }

  if (!activeAccount) {
    return contractV1WriteFailure({
      code: "wallet_disconnected",
      stage: "preflight",
      retryable: false,
    });
  }

  if (activeAccount.toLowerCase() !== account.toLowerCase()) {
    return contractV1WriteFailure({
      code: "account_changed",
      stage: "preflight",
      retryable: false,
    });
  }

  return {
    ok: true,
    value: undefined,
  };
}

function parseChainId(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number.parseInt(value, value.startsWith("0x") ? 16 : 10);
  }

  return null;
}

function firstAddress(accounts: unknown) {
  const address = Array.isArray(accounts) ? accounts[0] : null;

  return typeof address === "string" && isAddress(address)
    ? getAddress(address)
    : null;
}
