import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  isAddress,
  recoverTypedDataAddress,
  stringToHex,
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
import {
  AUCTION_SLOTS,
  DEMO_BOT_BID,
  MVP_DEMO_AUCTION_START_TIMESTAMP_MS,
} from "@/lib/auction/constants";
import { getAuctionClock } from "@/lib/auction/auctionTimer";
import { getSettlementEligibleLiveSlotIds } from "@/lib/auction/liveSlotCompletion";
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

const arcMemoAddress = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505";

const arcMemoAbi = [
  {
    type: "function",
    name: "memo",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
      { name: "memoId", type: "bytes32" },
      { name: "memoData", type: "bytes" },
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
  bidAuthorization: SignedBidAuthorization;
};

type OperatorSettlementCandidate = {
  chainId: number;
  escrowAddress: Address;
  treasuryAddress: Address;
  usdcAddress: Address;
  cycleId: string;
  slotId: string;
  advertiserAddress: Address;
  businessName: string;
  advertisementName: string;
  amountMinorUnits: bigint;
};

const accountingSlotIds = AUCTION_SLOTS.map(
  (_, index) => `slot-${index + 1}`
) as `slot-${number}`[];

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
  const result = (candidate as { result?: unknown }).result;
  const bidAuthorization =
    result && typeof result === "object"
      ? parseSignedBidAuthorization(
          (result as { bidAuthorization?: unknown }).bidAuthorization
        )
      : null;

  if (
    candidate.status !== "processing" ||
    typeof candidate.settlementId !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(candidate.settlementId) ||
    !bidAuthorization
  ) {
    return null;
  }

  return {
    settlementId: candidate.settlementId as Hex,
    status: "processing",
    bidAuthorization,
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

function getSlotIndex(slotId: string) {
  const slotIndex = accountingSlotIds.indexOf(slotId as `slot-${number}`);

  return slotIndex >= 0 ? slotIndex : null;
}

function parseBidAmountMinorUnits(value: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const amountMinorUnits = BigInt(value);

  return amountMinorUnits > BigInt(0) ? amountMinorUnits : null;
}

function createCandidateFromSignedPayload(
  input: OperatorSettlementRequest,
  escrowAddress: Address
):
  | { ok: true; candidate: OperatorSettlementCandidate }
  | { ok: false; code: string; error: string } {
  const { payload } = input.bidAuthorization;

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

  const amountMinorUnits = parseBidAmountMinorUnits(
    payload.bidAmountMinorUnits
  );

  if (amountMinorUnits === null) {
    return {
      ok: false,
      code: "INVALID_AMOUNT",
      error: "Settlement amount must be greater than zero.",
    };
  }

  if (amountMinorUnits <= BigInt(DEMO_BOT_BID)) {
    return {
      ok: false,
      code: "BID_DID_NOT_BEAT_DEMO_BOT",
      error: "Bid did not beat the Demo Bot price.",
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
    payload.chainId !== ARC_CHAIN_ID ||
    !addressEquals(payload.escrowAddress, escrowAddress) ||
    !addressEquals(payload.treasuryAddress, ARC_TREASURY_ADDRESS) ||
    !addressEquals(payload.usdcAddress, ARC_USDC_CONTRACT_ADDRESS)
  ) {
    return {
      ok: false,
      code: "SETTLEMENT_CONFIG_MISMATCH",
      error: "Bid authorization does not match server settlement configuration.",
    };
  }

  const slotIndex = getSlotIndex(payload.slotId);

  if (slotIndex === null) {
    return {
      ok: false,
      code: "INVALID_SLOT",
      error: "Settlement slot is invalid.",
    };
  }

  const currentClock = getAuctionClock(MVP_DEMO_AUCTION_START_TIMESTAMP_MS);
  const eligibleSlotIds = getSettlementEligibleLiveSlotIds(
    currentClock,
    accountingSlotIds
  );

  if (
    currentClock.phase !== "live" ||
    String(currentClock.cycleId) !== payload.cycleId ||
    !eligibleSlotIds.includes(payload.slotId as `slot-${number}`)
  ) {
    return {
      ok: false,
      code: "SETTLEMENT_WINDOW_NOT_OPEN",
      error: "Settlement window is not open for this cycle and slot.",
    };
  }

  return {
    ok: true,
    candidate: {
      chainId: ARC_CHAIN_ID,
      escrowAddress,
      treasuryAddress: ARC_TREASURY_ADDRESS,
      usdcAddress: ARC_USDC_CONTRACT_ADDRESS,
      cycleId: payload.cycleId,
      slotId: payload.slotId,
      advertiserAddress: payload.advertiserAddress,
      businessName: payload.businessName,
      advertisementName: payload.advertisementName,
      amountMinorUnits,
    },
  };
}

async function verifySettlementAuthorization(
  input: OperatorSettlementRequest
): Promise<AuthorizationVerificationResult> {
  try {
    const recoveredSigner = await recoverTypedDataAddress({
      ...createBidAuthorizationTypedData(input.bidAuthorization.payload),
      signature: input.bidAuthorization.signature,
    });

    if (
      !addressEquals(
        recoveredSigner,
        input.bidAuthorization.payload.advertiserAddress
      )
    ) {
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

function createSettlementMemoData(
  candidate: OperatorSettlementCandidate,
  settlementId: Hex
) {
  return stringToHex(
    JSON.stringify({
      v: 1,
      type: "pdooh.settlement",
      settlementId,
      cycleId: candidate.cycleId,
      slotId: candidate.slotId,
      advertiser: candidate.advertiserAddress,
      company: candidate.businessName,
      ad: candidate.advertisementName,
      amountMinor: candidate.amountMinorUnits.toString(),
    })
  );
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

    const candidateResult = createCandidateFromSignedPayload(
      input,
      escrowAddress
    );

    if (!candidateResult.ok) {
      return Response.json(
        {
          ok: false,
          settlementId: input.settlementId,
          code: candidateResult.code,
          error: candidateResult.error,
        },
        { status: 400 }
      );
    }

    const { candidate } = candidateResult;

    const expectedSettlementId = createSettlementId(candidate);

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

    const authorizationResult = await verifySettlementAuthorization(input);

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

    // MVP demo validation only: the route reconstructs the settlement from the
    // signed bid payload, checks the Demo Bot threshold and shared demo clock,
    // but this is not a production server-side auction ledger.
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

    const memoCode = await publicClient.getCode({
      address: arcMemoAddress,
    });

    if (!memoCode || memoCode === "0x") {
      throw new Error("Arc Memo contract is not deployed on Arc Testnet.");
    }

    const settlementArgs = [
      candidate.advertiserAddress,
      candidate.amountMinorUnits,
      input.settlementId,
    ] as const;

    await publicClient.simulateContract({
      account,
      address: escrowAddress,
      abi: auctionEscrowAbi,
      functionName: "settle",
      args: settlementArgs,
    });

    const settlementCalldata = encodeFunctionData({
      abi: auctionEscrowAbi,
      functionName: "settle",
      args: settlementArgs,
    });
    const memoData = createSettlementMemoData(candidate, input.settlementId);

    const transactionHash =
      await walletClient.writeContract({
        address: arcMemoAddress,
        abi: arcMemoAbi,
        functionName: "memo",
        args: [
          escrowAddress,
          settlementCalldata,
          input.settlementId,
          memoData,
        ],
      });
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
