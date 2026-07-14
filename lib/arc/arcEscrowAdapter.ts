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
import { getArcEscrowAddress } from "./arcEscrowConfig";
import {
  getActiveArcWalletProvider,
  getArcWalletState,
} from "./arcWalletAdapter";
import {
  formatUSDCFromMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

const auctionEscrowAbi = [
  {
    type: "function",
    name: "usdc",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "treasury",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "advertiser", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

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

export type ArcEscrowDepositLifecycle = {
  onApprovalWalletRequest?: () => void;
  onApprovalPending?: (transactionHash: Hash) => void;
  onApprovalConfirmed?: (transactionHash: Hash) => void;
  onDepositWalletRequest?: () => void;
  onDepositPending?: (transactionHash: Hash) => void;
};

export type ArcEscrowDepositResult = {
  approvalTransactionHash: Hash;
  depositTransactionHash: Hash;
};

export type ArcEscrowWithdrawLifecycle = {
  onWithdrawWalletRequest?: () => void;
  onWithdrawPending?: (transactionHash: Hash) => void;
};

export type ArcEscrowWithdrawResult = {
  withdrawTransactionHash: Hash;
};

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

function assertValidDepositAmount(amount: UsdcMinorUnits) {
  if (!Number.isSafeInteger(amount)) {
    throw new TypeError("USDC amount must be a safe integer in minor units.");
  }

  if (amount <= 0) {
    throw new RangeError("Escrow deposit amount must be greater than zero.");
  }
}

function assertValidWithdrawAmount(amount: UsdcMinorUnits) {
  if (!Number.isSafeInteger(amount)) {
    throw new TypeError("USDC amount must be a safe integer in minor units.");
  }

  if (amount <= 0) {
    throw new RangeError("Escrow withdraw amount must be greater than zero.");
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

async function getArcUsdcTokenBalance(owner: Address) {
  const balance = await arcPublicClient.readContract({
    address: ARC_USDC_CONTRACT_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });

  return toSafeUsdcMinorUnits(balance);
}

async function assertWalletCanDeposit(account: Address, amount: UsdcMinorUnits) {
  const balance = await getArcUsdcTokenBalance(account);

  if (amount > balance) {
    throw new Error(
      `Deposit amount exceeds your wallet balance. Available: ${formatAvailableBalance(
        balance
      )}.`
    );
  }
}

async function assertEscrowCanWithdraw(
  escrowAddress: Address,
  account: Address,
  amount: UsdcMinorUnits
) {
  const balance = await arcPublicClient.readContract({
    address: escrowAddress,
    abi: auctionEscrowAbi,
    functionName: "balanceOf",
    args: [account],
  });
  const escrowBalance = toSafeUsdcMinorUnits(balance);

  if (amount > escrowBalance) {
    throw new Error(
      `Withdraw amount exceeds your escrow balance. Available: ${formatAvailableBalance(
        escrowBalance
      )}.`
    );
  }
}

async function getEscrowTransactionContext() {
  const wallet = getArcWalletState();
  const provider = getActiveArcWalletProvider();

  if (!wallet.connected || !wallet.address || !provider) {
    throw new Error("Log in with an external wallet before depositing USDC.");
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

async function validateArcEscrowContract(escrowAddress: Address) {
  const bytecode = await arcPublicClient.getBytecode({
    address: escrowAddress,
  });

  if (!bytecode || bytecode === "0x") {
    throw new Error(
      "Configured pDOOH escrow address has no contract bytecode on Arc Testnet."
    );
  }

  const [escrowUsdc, escrowTreasury] = await Promise.all([
    arcPublicClient.readContract({
      address: escrowAddress,
      abi: auctionEscrowAbi,
      functionName: "usdc",
    }),
    arcPublicClient.readContract({
      address: escrowAddress,
      abi: auctionEscrowAbi,
      functionName: "treasury",
    }),
  ]);

  if (
    escrowUsdc.toLowerCase() !== ARC_USDC_CONTRACT_ADDRESS.toLowerCase()
  ) {
    throw new Error(
      "Configured pDOOH escrow does not use the Arc Testnet ERC-20 USDC address."
    );
  }

  if (escrowTreasury.toLowerCase() !== ARC_TREASURY_ADDRESS.toLowerCase()) {
    throw new Error(
      "Configured pDOOH escrow Treasury does not match the application Treasury."
    );
  }
}

async function waitForSuccessfulArcTransaction(hash: Hash) {
  const receipt = await arcPublicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error("The Arc Testnet transaction was reverted.");
  }

  void refreshArcFeeSignal();
}

export async function getArcEscrowBalance(
  advertiserAddress: string
): Promise<UsdcMinorUnits> {
  if (!isAddress(advertiserAddress)) {
    throw new Error("Wallet address is not a valid EVM address.");
  }

  const escrowAddress = getArcEscrowAddress();

  await validateArcEscrowContract(escrowAddress);

  const balance = await arcPublicClient.readContract({
    address: escrowAddress,
    abi: auctionEscrowAbi,
    functionName: "balanceOf",
    args: [advertiserAddress],
  });

  return toSafeUsdcMinorUnits(balance);
}

export async function depositArcUsdcToEscrow(
  amount: UsdcMinorUnits,
  lifecycle: ArcEscrowDepositLifecycle = {}
): Promise<ArcEscrowDepositResult> {
  assertValidDepositAmount(amount);

  const escrowAddress = getArcEscrowAddress();

  await validateArcEscrowContract(escrowAddress);

  const approvalContext = await getEscrowTransactionContext();

  await assertWalletCanDeposit(approvalContext.account, amount);

  const { request: approvalRequest } = await arcPublicClient.simulateContract({
    account: approvalContext.account,
    address: ARC_USDC_CONTRACT_ADDRESS,
    abi: erc20Abi,
    functionName: "approve",
    args: [escrowAddress, BigInt(amount)],
  });

  lifecycle.onApprovalWalletRequest?.();

  const approvalTransactionHash =
    await approvalContext.walletClient.writeContract(approvalRequest);

  lifecycle.onApprovalPending?.(approvalTransactionHash);
  await waitForSuccessfulArcTransaction(approvalTransactionHash);
  lifecycle.onApprovalConfirmed?.(approvalTransactionHash);

  const depositContext = await getEscrowTransactionContext();

  if (
    depositContext.account.toLowerCase() !==
    approvalContext.account.toLowerCase()
  ) {
    throw new Error(
      "The active wallet account changed after approval. Deposit was not submitted."
    );
  }

  await assertWalletCanDeposit(depositContext.account, amount);

  const { request: depositRequest } = await arcPublicClient.simulateContract({
    account: depositContext.account,
    address: escrowAddress,
    abi: auctionEscrowAbi,
    functionName: "deposit",
    args: [BigInt(amount)],
  });

  lifecycle.onDepositWalletRequest?.();

  const depositTransactionHash =
    await depositContext.walletClient.writeContract(depositRequest);

  lifecycle.onDepositPending?.(depositTransactionHash);
  await waitForSuccessfulArcTransaction(depositTransactionHash);

  return {
    approvalTransactionHash,
    depositTransactionHash,
  };
}

export async function withdrawArcUsdcFromEscrow(
  amount: UsdcMinorUnits,
  lifecycle: ArcEscrowWithdrawLifecycle = {}
): Promise<ArcEscrowWithdrawResult> {
  assertValidWithdrawAmount(amount);

  const escrowAddress = getArcEscrowAddress();

  await validateArcEscrowContract(escrowAddress);

  const withdrawContext = await getEscrowTransactionContext();

  await assertEscrowCanWithdraw(escrowAddress, withdrawContext.account, amount);

  const { request: withdrawRequest } = await arcPublicClient.simulateContract({
    account: withdrawContext.account,
    address: escrowAddress,
    abi: auctionEscrowAbi,
    functionName: "withdraw",
    args: [BigInt(amount)],
  });

  lifecycle.onWithdrawWalletRequest?.();

  const withdrawTransactionHash =
    await withdrawContext.walletClient.writeContract(withdrawRequest);

  lifecycle.onWithdrawPending?.(withdrawTransactionHash);
  await waitForSuccessfulArcTransaction(withdrawTransactionHash);

  return {
    withdrawTransactionHash,
  };
}
