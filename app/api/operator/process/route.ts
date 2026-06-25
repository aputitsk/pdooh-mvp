import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { createSettlementId } from "@/lib/accounting/settlementRecords";
import {
  ARC_CHAIN_ID,
  ARC_CHAIN_NAME,
  ARC_EXPLORER_URL,
  ARC_NATIVE_CURRENCY_SYMBOL,
  ARC_RPC_URL,
} from "@/lib/arc/arcConstants";
import { getArcEscrowAddress } from "@/lib/arc/arcEscrowConfig";

export const runtime = "nodejs";

const auctionEscrowAbi = [
  {
    type: "function",
    name: "operator",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "processedSettlement",
    stateMutability: "view",
    inputs: [{ name: "settlementId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "advertiser", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "settlementId", type: "bytes32" },
    ],
    outputs: [],
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
  rpcUrls: { default: { http: [ARC_RPC_URL] } },
  blockExplorers: {
    default: { name: "ArcScan", url: ARC_EXPLORER_URL },
  },
  testnet: true,
} as const satisfies Chain;

type OperatorSettlementRequest = {
  settlementId: Hex;
  status: "processing";
  result: {
    chainId: number;
    escrowAddress: Address;
    cycleId: string;
    slotId: string;
    advertiserAddress: Address;
    advertisementName: string;
    amountMinorUnits: string;
  };
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseRequest(value: unknown): OperatorSettlementRequest | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<OperatorSettlementRequest>;
  const result = candidate.result;

  if (
    candidate.status !== "processing" ||
    typeof candidate.settlementId !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(candidate.settlementId) ||
    typeof result !== "object" ||
    result === null ||
    result.chainId !== ARC_CHAIN_ID ||
    !isAddress(result.escrowAddress ?? "") ||
    !isAddress(result.advertiserAddress ?? "") ||
    !isNonEmptyString(result.cycleId) ||
    !isNonEmptyString(result.slotId) ||
    !isNonEmptyString(result.advertisementName) ||
    !isNonEmptyString(result.amountMinorUnits) ||
    !/^\d+$/.test(result.amountMinorUnits)
  ) {
    return null;
  }

  return candidate as OperatorSettlementRequest;
}

function getOperatorPrivateKey(): Hex {
  const value = process.env.OPERATOR_PRIVATE_KEY;

  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("OPERATOR_PRIVATE_KEY is not configured.");
  }

  return value as Hex;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Settlement failed.";
}

export async function POST(request: Request) {
  try {
    const input = parseRequest(await request.json());

    if (!input) {
      return Response.json(
        { ok: false, code: "INVALID_REQUEST", error: "Invalid settlement." },
        { status: 400 }
      );
    }

    const escrowAddress = getArcEscrowAddress();

    if (
      input.result.escrowAddress.toLowerCase() !==
      escrowAddress.toLowerCase()
    ) {
      return Response.json(
        {
          ok: false,
          settlementId: input.settlementId,
          code: "ESCROW_MISMATCH",
          error: "Settlement escrow does not match server configuration.",
        },
        { status: 400 }
      );
    }

    const amountMinorUnits = BigInt(input.result.amountMinorUnits);

    if (amountMinorUnits <= BigInt(0)) {
      return Response.json(
        {
          ok: false,
          settlementId: input.settlementId,
          code: "INVALID_AMOUNT",
          error: "Settlement amount must be greater than zero.",
        },
        { status: 400 }
      );
    }

    const expectedSettlementId = createSettlementId({
      ...input.result,
      amountMinorUnits,
    });

    if (expectedSettlementId.toLowerCase() !== input.settlementId.toLowerCase()) {
      return Response.json(
        {
          ok: false,
          settlementId: input.settlementId,
          code: "SETTLEMENT_ID_MISMATCH",
          error: "Settlement ID does not match settlement contents.",
        },
        { status: 400 }
      );
    }

    // Production TODO: replace the demo browser-owned auction trust boundary
    // with authoritative server or on-chain winner verification.
    const account = privateKeyToAccount(getOperatorPrivateKey());
    const publicClient = createPublicClient({
      chain: arcTestnetChain,
      transport: http(ARC_RPC_URL),
    });
    const walletClient = createWalletClient({
      account,
      chain: arcTestnetChain,
      transport: http(ARC_RPC_URL),
    });

    const configuredOperator = await publicClient.readContract({
      address: escrowAddress,
      abi: auctionEscrowAbi,
      functionName: "operator",
    });

    if (configuredOperator.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(
        "OPERATOR_PRIVATE_KEY does not match the escrow operator."
      );
    }

    const alreadyProcessed = await publicClient.readContract({
      address: escrowAddress,
      abi: auctionEscrowAbi,
      functionName: "processedSettlement",
      args: [input.settlementId],
    });

    if (alreadyProcessed) {
      return Response.json({
        ok: true,
        settlementId: input.settlementId,
        status: "already_settled",
      });
    }

    const { request: settlementRequest } =
      await publicClient.simulateContract({
        account,
        address: escrowAddress,
        abi: auctionEscrowAbi,
        functionName: "settle",
        args: [
          input.result.advertiserAddress,
          amountMinorUnits,
          input.settlementId,
        ],
      });
    const transactionHash =
      await walletClient.writeContract(settlementRequest);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    });

    if (receipt.status !== "success") {
      throw new Error("Settlement transaction reverted.");
    }

    return Response.json({
      ok: true,
      settlementId: input.settlementId,
      transactionHash,
      status: "settled",
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        code: "SETTLEMENT_FAILED",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
