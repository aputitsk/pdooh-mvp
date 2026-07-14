import { isAddress } from "viem";

import {
  getStoredAccountBusinessProfile,
  saveStoredAccountBusinessProfile,
} from "@/lib/advertiser/businessProfileStore";

export const runtime = "nodejs";

const BUSINESS_NAME_MAX_LENGTH = 20;

function normalizeBusinessName(value: unknown) {
  return typeof value === "string"
    ? value.trim().slice(0, BUSINESS_NAME_MAX_LENGTH)
    : "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const walletAddress = url.searchParams.get("walletAddress");

  if (!walletAddress || !isAddress(walletAddress)) {
    return Response.json(
      {
        ok: false,
        code: "INVALID_WALLET_ADDRESS",
        error: "Wallet address is invalid.",
      },
      { status: 400 }
    );
  }

  const profile = await getStoredAccountBusinessProfile(walletAddress);

  return Response.json({
    ok: true,
    profile,
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Partial<{
    businessName: unknown;
    walletAddress: unknown;
  }>;
  const walletAddress =
    typeof body.walletAddress === "string" ? body.walletAddress : "";
  const businessName = normalizeBusinessName(body.businessName);

  if (!isAddress(walletAddress)) {
    return Response.json(
      {
        ok: false,
        code: "INVALID_WALLET_ADDRESS",
        error: "Wallet address is invalid.",
      },
      { status: 400 }
    );
  }

  if (!businessName) {
    return Response.json(
      {
        ok: false,
        code: "INVALID_BUSINESS_NAME",
        error: "Business name is required.",
      },
      { status: 400 }
    );
  }

  const profile = await saveStoredAccountBusinessProfile({
    businessName,
    updatedAt: new Date().toISOString(),
    walletAddress,
  });

  return Response.json({
    ok: true,
    profile,
  });
}
