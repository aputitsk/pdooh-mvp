import { getAddress, isAddress, type Address } from "viem";

import { auctionEscrowV2ReadAbi } from "./abi";
import { arcPublicClient } from "../rpc/publicClient";
import type {
  ContractV1Bytes32,
  ContractV1EscrowAccount,
  ContractV1EscrowStaticConfig,
  ContractV1Reservation,
} from "./types";

export type ContractV1ReadClient = Pick<typeof arcPublicClient, "readContract">;

function asBigInt(value: unknown, fieldName: string) {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }

  throw new TypeError(`${fieldName} must be an integer bigint.`);
}

function asBoolean(value: unknown, fieldName: string) {
  if (typeof value === "boolean") {
    return value;
  }

  throw new TypeError(`${fieldName} must be a boolean.`);
}

function asAddress(value: unknown, fieldName: string): Address {
  if (typeof value === "string" && isAddress(value)) {
    return getAddress(value);
  }

  throw new TypeError(`${fieldName} must be an EVM address.`);
}

function tupleField(value: unknown, key: string, index: number) {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Contract tuple result must be an object.");
  }

  const record = value as Record<string, unknown>;

  if (key in record) {
    return record[key];
  }

  if (Array.isArray(value)) {
    return value[index];
  }

  throw new TypeError(`Contract tuple result is missing ${key}.`);
}

function normalizeReservation(value: unknown): ContractV1Reservation {
  return {
    payer: asAddress(tupleField(value, "payer", 0), "payer"),
    beneficiary: asAddress(tupleField(value, "beneficiary", 1), "beneficiary"),
    engine: asAddress(tupleField(value, "engine", 2), "engine"),
    reservedAmount: asBigInt(
      tupleField(value, "reservedAmount", 3),
      "reservedAmount"
    ),
    finalAmount: asBigInt(tupleField(value, "finalAmount", 4), "finalAmount"),
    settled: asBoolean(tupleField(value, "settled", 5), "settled"),
    released: asBoolean(tupleField(value, "released", 6), "released"),
  };
}

export async function readContractV1EscrowStaticConfig({
  client = arcPublicClient,
  escrowAddress,
}: {
  client?: ContractV1ReadClient;
  escrowAddress: Address;
}): Promise<ContractV1EscrowStaticConfig> {
  const [engineAddress, usdcAddress] = await Promise.all([
    client.readContract({
      address: escrowAddress,
      abi: auctionEscrowV2ReadAbi,
      functionName: "engine",
    }),
    client.readContract({
      address: escrowAddress,
      abi: auctionEscrowV2ReadAbi,
      functionName: "usdc",
    }),
  ]);

  return {
    engineAddress: asAddress(engineAddress, "AuctionEscrowV2.engine"),
    usdcAddress: asAddress(usdcAddress, "AuctionEscrowV2.usdc"),
  };
}

export async function readContractV1EscrowAccount({
  client = arcPublicClient,
  escrowAddress,
  walletAddress,
}: {
  client?: ContractV1ReadClient;
  escrowAddress: Address;
  walletAddress: Address;
}): Promise<ContractV1EscrowAccount> {
  const [balance, available, reserved] = await Promise.all([
    client.readContract({
      address: escrowAddress,
      abi: auctionEscrowV2ReadAbi,
      functionName: "balanceOf",
      args: [walletAddress],
    }),
    client.readContract({
      address: escrowAddress,
      abi: auctionEscrowV2ReadAbi,
      functionName: "availableOf",
      args: [walletAddress],
    }),
    client.readContract({
      address: escrowAddress,
      abi: auctionEscrowV2ReadAbi,
      functionName: "reservedOf",
      args: [walletAddress],
    }),
  ]);

  return {
    walletAddress,
    balance: asBigInt(balance, "AuctionEscrowV2.balanceOf"),
    available: asBigInt(available, "AuctionEscrowV2.availableOf"),
    reserved: asBigInt(reserved, "AuctionEscrowV2.reservedOf"),
  };
}

export async function readContractV1Reservation({
  client = arcPublicClient,
  escrowAddress,
  reservationId,
}: {
  client?: ContractV1ReadClient;
  escrowAddress: Address;
  reservationId: ContractV1Bytes32;
}): Promise<ContractV1Reservation> {
  const reservation = await client.readContract({
    address: escrowAddress,
    abi: auctionEscrowV2ReadAbi,
    functionName: "getReservation",
    args: [reservationId],
  });

  return normalizeReservation(reservation);
}
