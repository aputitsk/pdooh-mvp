import { isAddress } from "viem";

import { getAccountRevenueSnapshot } from "@/lib/accounting/accountRevenueStore";

export const runtime = "nodejs";

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

  const snapshot = await getAccountRevenueSnapshot(walletAddress);

  return Response.json({
    ok: true,
    snapshot,
  });
}
