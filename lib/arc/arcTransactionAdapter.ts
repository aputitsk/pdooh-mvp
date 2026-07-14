import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  http,
  isAddress,
  type Address,
  type Chain,
  type Hash,
} from "viem";

import { ARC_TREASURY_ADDRESS } from "./arcConfig";
import { refreshArcFeeSignal } from "./arcFeeSignal";
import {
  ARC_CHAIN_ID,
  ARC_CHAIN_NAME,
  ARC_EXPLORER_URL,
  ARC_NATIVE_CURRENCY_SYMBOL,
  ARC_RPC_URL,
  ARC_USDC_CONTRACT_ADDRESS,
} from "./arcConstants";
import {
  getActiveArcWalletProvider,
  getArcWalletState,
} from "./arcWalletAdapter";
import {
  formatUSDCFromMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

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

function parseChainId(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number.parseInt(value, value.startsWith("0x") ? 16 : 10);
  }

  return null;
}

function firstAddress(accounts: unknown): Address | null {
  const address = Array.isArray(accounts) ? accounts[0] : null;

  return typeof address === "string" && isAddress(address) ? address : null;
}

function assertValidTransferAmount(amount: UsdcMinorUnits) {
  if (!Number.isSafeInteger(amount)) {
    throw new TypeError("USDC amount must be a safe integer in minor units.");
  }

  if (amount <= 0) {
    throw new RangeError("USDC transfer amount must be greater than zero.");
  }
}

function toSafeUsdcMinorUnits(balance: bigint): UsdcMinorUnits {
  if (balance < BigInt(0)) {
    throw new RangeError("USDC balance cannot be negative.");
  }

  if (balance > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("USDC balance exceeds safe integer range.");
  }

  return Number(balance);
}

function formatAvailableBalance(balance: UsdcMinorUnits) {
  return `${formatUSDCFromMinorUnits(balance)} Test USDC`;
}

async function assertWalletCanTransfer(account: Address, amount: UsdcMinorUnits) {
  const balance = await arcPublicClient.readContract({
    address: ARC_USDC_CONTRACT_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  });
  const walletBalance = toSafeUsdcMinorUnits(balance);

  if (amount > walletBalance) {
    throw new Error(
      `Transfer amount exceeds your wallet balance. Available: ${formatAvailableBalance(
        walletBalance
      )}.`
    );
  }
}

async function getTransactionContext() {
  const wallet = getArcWalletState();
  const provider = getActiveArcWalletProvider();

  if (!wallet.connected || !wallet.address || !provider) {
    throw new Error("Log in with an external wallet before sending USDC.");
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

  return {
    account: activeAddress,
    walletClient: createWalletClient({
      account: activeAddress,
      chain: arcTestnetChain,
      transport: custom(provider),
    }),
  };
}

export async function transferArcUsdcToTreasury(
  amount: UsdcMinorUnits,
  onWalletRequest?: () => void
): Promise<Hash> {
  assertValidTransferAmount(amount);

  const { account, walletClient } = await getTransactionContext();

  await assertWalletCanTransfer(account, amount);

  const { request } = await arcPublicClient.simulateContract({
    account,
    address: ARC_USDC_CONTRACT_ADDRESS,
    abi: erc20Abi,
    functionName: "transfer",
    args: [ARC_TREASURY_ADDRESS, BigInt(amount)],
  });

  onWalletRequest?.();

  return walletClient.writeContract(request);
}

export async function waitForArcTransaction(hash: Hash) {
  const receipt = await arcPublicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error("The Arc Testnet transaction was reverted.");
  }

  void refreshArcFeeSignal();
}
