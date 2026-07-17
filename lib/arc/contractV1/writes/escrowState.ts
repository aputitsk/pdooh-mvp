import type { Address } from "viem";

import type {
  ContractV1EscrowState,
  ContractV1ReadContractClient,
  ContractV1WalletWriteContext,
  ContractV1WriteResult,
  ContractV1WriteStage,
} from "./types";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { contractV1WriteFailure, getContractV1ReadBlockNumber, readContractV1BigInt } from "./errors.ts";

const escrowStateAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "availableOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "reservedOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export function validateContractV1EscrowWriteContext(
  context: ContractV1WalletWriteContext,
  amount: bigint
): ContractV1WriteResult<{ account: Address; escrowAddress: Address }> {
  if (context.mode !== "contract_v1" || !context.configValid || !context.escrowAddress) {
    return contractV1WriteFailure({
      code: "invalid_config",
      stage: "preflight",
      retryable: false,
    });
  }

  if (context.chainId !== context.expectedChainId) {
    return contractV1WriteFailure({
      code: "wrong_chain",
      stage: "preflight",
      retryable: false,
    });
  }

  if (!context.account) {
    return contractV1WriteFailure({
      code: "wallet_disconnected",
      stage: "preflight",
      retryable: false,
    });
  }

  if (amount <= BigInt(0)) {
    return contractV1WriteFailure({
      code: "invalid_amount",
      stage: "preflight",
      retryable: false,
    });
  }

  return {
    ok: true,
    value: {
      account: context.account,
      escrowAddress: context.escrowAddress,
    },
  };
}

export async function readContractV1EscrowState({
  readClient,
  escrowAddress,
  account,
  stage,
  blockNumber,
}: {
  readClient: ContractV1ReadContractClient;
  escrowAddress: Address;
  account: Address;
  stage: ContractV1WriteStage;
  blockNumber?: bigint;
}): Promise<ContractV1WriteResult<ContractV1EscrowState>> {
  const readBlockNumber = blockNumber
    ? { ok: true as const, value: blockNumber }
    : await getContractV1ReadBlockNumber(readClient, stage);

  if (!readBlockNumber.ok) {
    return readBlockNumber;
  }

  const balance = await readEscrowValue({
    readClient,
    escrowAddress,
    account,
    functionName: "balanceOf",
    stage,
    blockNumber: readBlockNumber.value,
  });
  const available = await readEscrowValue({
    readClient,
    escrowAddress,
    account,
    functionName: "availableOf",
    stage,
    blockNumber: readBlockNumber.value,
  });
  const reserved = await readEscrowValue({
    readClient,
    escrowAddress,
    account,
    functionName: "reservedOf",
    stage,
    blockNumber: readBlockNumber.value,
  });

  if (!balance.ok) {
    return balance;
  }

  if (!available.ok) {
    return available;
  }

  if (!reserved.ok) {
    return reserved;
  }

  return {
    ok: true,
    value: {
      balance: balance.value,
      available: available.value,
      reserved: reserved.value,
      blockNumber: readBlockNumber.value,
    },
  };
}

export function isValidContractV1EscrowState(state: ContractV1EscrowState) {
  return state.available + state.reserved === state.balance;
}

function readEscrowValue({
  readClient,
  escrowAddress,
  account,
  functionName,
  stage,
  blockNumber,
}: {
  readClient: ContractV1ReadContractClient;
  escrowAddress: Address;
  account: Address;
  functionName: "balanceOf" | "availableOf" | "reservedOf";
  stage: ContractV1WriteStage;
  blockNumber: bigint;
}) {
  return readContractV1BigInt({
    readClient,
    stage,
    request: {
      address: escrowAddress,
      abi: escrowStateAbi,
      functionName,
      args: [account],
      blockNumber,
    },
  });
}
