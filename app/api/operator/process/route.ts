import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  recoverTypedDataAddress,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { createSettlementId } from "@/lib/accounting/settlementRecords";
import { ARC_TREASURY_ADDRESS } from "@/lib/arc/arcConfig";
import { createBidAuthorizationTypedData } from "@/lib/arc/arcBidAuthorizationTypedData";
import {
  ARC_CHAIN_ID,
  ARC_CHAIN_NAME,
  ARC_EXPLORER_URL,
  ARC_NATIVE_CURRENCY_SYMBOL,
  ARC_RPC_URL,
  ARC_USDC_CONTRACT_ADDRESS,
} from "@/lib/arc/arcConstants";
import { getArcEscrowAddress } from "@/lib/arc/arcEscrowConfig";
import type {
  BidAuthorizationPayload,
  SignedBidAuthorization,
} from "@/lib/auction/auctionTypes";

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
    treasuryAddress: Address;
    usdcAddress: Address;
    cycleId: string;
    slotId: string;
    advertiserAddress: Address;
    businessName: string;
    advertisementName: string;
    amountMinorUnits: string;
    bidAuthorization: SignedBidAuthorization;
  };
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isHexSignature(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value);
}

function parseBidAuthorizationPayload(
  value: unknown
): BidAuthorizationPayload | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const payload = value as Partial<BidAuthorizationPayload>;

  if (
    payload.purpose !== "PDOOH_BID_AUTHORIZATION" ||
    payload.version !== "1" ||
    !isAddress(payload.advertiserAddress ?? "") ||
    !isNonEmptyString(payload.businessName) ||
    !isNonEmptyString(payload.advertisementName) ||
    !isNonEmptyString(payload.slotId) ||
    !isNonEmptyString(payload.cycleId) ||
    !isNonEmptyString(payload.bidAmountMinorUnits) ||
    typeof payload.chainId !== "number" ||
    !isAddress(payload.escrowAddress ?? "") ||
    !isAddress(payload.treasuryAddress ?? "") ||
    !isAddress(payload.usdcAddress ?? "") ||
    !isNonEmptyString(payload.expiresAt)
  ) {
    return null;
  }

  return payload as BidAuthorizationPayload;
}

function parseSignedBidAuthorization(
  value: unknown
): SignedBidAuthorization | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<SignedBidAuthorization>;
  const payload = parseBidAuthorizationPayload(candidate.payload);

  if (!payload || !isHexSignature(candidate.signature)) {
    return null;
  }

  return {
    payload,
    signature: candidate.signature,
  };
}

function parseRequest(value: unknown): OperatorSettlementRequest | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<OperatorSettlementRequest>;
  const result = candidate.result;
  const bidAuthorization =
    result && typeof result === "object"
      ? parseSignedBidAuthorization(result.bidAuthorization)
      : null;

  if (
    candidate.status !== "processing" ||
    typeof candidate.settlementId !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(candidate.settlementId) ||
    typeof result !== "object" ||
    result === null ||
    result.chainId !== ARC_CHAIN_ID ||
    !isAddress(result.escrowAddress ?? "") ||
    !isAddress(result.treasuryAddress ?? "") ||
    !isAddress(result.usdcAddress ?? "") ||
    !isAddress(result.advertiserAddress ?? "") ||
    !isNonEmptyString(result.cycleId) ||
    !isNonEmptyString(result.slotId) ||
    !isNonEmptyString(result.businessName) ||
    !isNonEmptyString(result.advertisementName) ||
    !isNonEmptyString(result.amountMinorUnits) ||
    !/^\d+$/.test(result.amountMinorUnits) ||
    !bidAuthorization
  ) {
    return null;
  }

  return {
    ...candidate,
    result: {
      ...result,
      bidAuthorization,
    },
  } as OperatorSettlementRequest;
}

type AuthorizationVerificationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      code: string;
      error: string;
    };

function addressEquals(left: Address, right: Address) {
  return left.toLowerCase() === right.toLowerCase();
}

function verifySignedPayloadMatchesSettlement(
  input: OperatorSettlementRequest,
  amountMinorUnits: bigint
): AuthorizationVerificationResult {
  const { result } = input;
  const { payload } = result.bidAuthorization;

  if (
    payload.purpose !== "PDOOH_BID_AUTHORIZATION" ||
    payload.version !== "1"
  ) {
    return {
      ok: false,
      code: "INVALID_BID_AUTHORIZATION",
      error: "Bid authorization purpose or version is invalid.",
    };
  }

  const expiresAtMs = Date.parse(payload.expiresAt);

  if (!Number.isFinite(expiresAtMs)) {
    return {
      ok: false,
      code: "INVALID_BID_AUTHORIZATION",
      error: "Bid authorization expiration is invalid.",
    };
  }

  if (expiresAtMs <= Date.now()) {
    return {
      ok: false,
      code: "BID_AUTHORIZATION_EXPIRED",
      error: "Bid authorization has expired.",
    };
  }

  if (
    !addressEquals(payload.advertiserAddress, result.advertiserAddress) ||
    payload.businessName !== result.businessName ||
    payload.advertisementName !== result.advertisementName ||
    payload.slotId !== result.slotId ||
    payload.cycleId !== result.cycleId ||
    payload.bidAmountMinorUnits !== amountMinorUnits.toString() ||
    payload.chainId !== result.chainId ||
    !addressEquals(payload.escrowAddress, result.escrowAddress) ||
    !addressEquals(payload.treasuryAddress, result.treasuryAddress) ||
    !addressEquals(payload.usdcAddress, result.usdcAddress)
  ) {
    return {
      ok: false,
      code: "BID_AUTHORIZATION_MISMATCH",
      error: "Bid authorization does not match settlement contents.",
    };
  }

  if (
    !addressEquals(result.treasuryAddress, ARC_TREASURY_ADDRESS) ||
    !addressEquals(result.usdcAddress, ARC_USDC_CONTRACT_ADDRESS)
  ) {
    return {
      ok: false,
      code: "TOKEN_OR_TREASURY_MISMATCH",
      error: "Settlement token or Treasury does not match server configuration.",
    };
  }

  return { ok: true };
}

async function verifySettlementAuthorization(
  input: OperatorSettlementRequest,
  amountMinorUnits: bigint
): Promise<AuthorizationVerificationResult> {
  const payloadMatch = verifySignedPayloadMatchesSettlement(
    input,
    amountMinorUnits
  );

  if (!payloadMatch.ok) {
    return payloadMatch;
  }

  try {
    const recoveredSigner = await recoverTypedDataAddress({
      ...createBidAuthorizationTypedData(input.result.bidAuthorization.payload),
      signature: input.result.bidAuthorization.signature,
    });

    if (!addressEquals(recoveredSigner, input.result.advertiserAddress)) {
      return {
        ok: false,
        code: "BID_AUTHORIZATION_SIGNER_MISMATCH",
        error: "Bid authorization signer does not match advertiser.",
      };
    }
  } catch {
    return {
      ok: false,
      code: "INVALID_BID_AUTHORIZATION_SIGNATURE",
      error: "Bid authorization signature is invalid.",
    };
  }

  return { ok: true };
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

    const authorizationResult = await verifySettlementAuthorization(
      input,
      amountMinorUnits
    );

    if (!authorizationResult.ok) {
      return Response.json(
        {
          ok: false,
          settlementId: input.settlementId,
          code: authorizationResult.code,
          error: authorizationResult.error,
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
