import assert from "node:assert/strict";
import test from "node:test";

import type { FinalizedAuctionResult } from "./settlementRecords.ts";

const advertiserAddress = "0x1111111111111111111111111111111111111111";
const escrowAddress = "0x2222222222222222222222222222222222222222";
const treasuryAddress = "0x3333333333333333333333333333333333333333";
const usdcAddress = "0x4444444444444444444444444444444444444444";
const settlementId =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const transactionHash =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const result: FinalizedAuctionResult = {
  advertisementName: "Launch Promo",
  advertiserAddress,
  amountMinorUnits: BigInt(275_000),
  bidAuthorization: undefined,
  chainId: 504,
  cycleId: "12",
  escrowAddress,
  marketId: "new-york",
  siteId: "times-square",
  slotId: "slot-2",
  businessName: "PDOOH Coffee",
  treasuryAddress,
  usdcAddress,
};

test("account revenue store applies settled revenue once per settlementId", async () => {
  const originalFetch = globalThis.fetch;
  const values = new Map<string, string>();
  const commands: unknown[][] = [];

  process.env.KV_REST_API_URL = "https://example-kv.upstash.io/";
  process.env.KV_REST_API_TOKEN = "test-token";

  globalThis.fetch = (async (input, init) => {
    assert.equal(input, "https://example-kv.upstash.io");
    assert.equal(init?.method, "POST");
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer test-token"
    );

    const command = JSON.parse(String(init?.body)) as unknown[];
    commands.push(command);

    if (command[0] === "GET" && typeof command[1] === "string") {
      return Response.json({ result: values.get(command[1]) ?? null });
    }

    if (
      command[0] === "EVAL" &&
      typeof command[3] === "string" &&
      typeof command[4] === "string" &&
      typeof command[5] === "string" &&
      typeof command[6] === "string" &&
      typeof command[7] === "string" &&
      typeof command[8] === "string"
    ) {
      const appliedKey = command[3];
      const totalKey = command[4];
      const lastKey = command[5];
      const appliedValue = command[6];
      const amount = BigInt(command[7]);
      const lastPayload = command[8];

      if (values.has(appliedKey)) {
        return Response.json({ result: [0, values.get(totalKey) ?? null] });
      }

      const currentTotal = BigInt(values.get(totalKey) ?? "0");
      const nextTotal = currentTotal + amount;

      values.set(appliedKey, String(appliedValue));
      values.set(totalKey, nextTotal.toString());
      values.set(lastKey, lastPayload);

      return Response.json({ result: [1, nextTotal.toString()] });
    }

    return Response.json({ error: "Unsupported command" }, { status: 400 });
  }) as typeof fetch;

  const storeModule = await import(
    `./accountRevenueStore.ts?test=${Date.now()}-${Math.random()}`
  );

  try {
    assert.equal(
      await storeModule.getAccountRevenueSnapshot(advertiserAddress),
      null
    );

    await storeModule.applySettledAccountRevenue({
      result,
      settledAt: "2026-07-14T19:00:00.000Z",
      settlementId,
      transactionHash,
    });
    await storeModule.applySettledAccountRevenue({
      result,
      settledAt: "2026-07-14T19:00:00.000Z",
      settlementId,
      transactionHash,
    });

    const snapshot =
      await storeModule.getAccountRevenueSnapshot(advertiserAddress);

    assert.equal(snapshot?.walletAddress, advertiserAddress);
    assert.equal(snapshot?.totalAmountMinorUnits, "275000");
    assert.equal(snapshot?.lastPayment?.transactionHash, transactionHash);
    assert.equal(snapshot?.lastPayment?.amountMinorUnits, "275000");
    assert.equal(snapshot?.lastMemo?.company, "PDOOH Coffee");
    assert.equal(
      commands.filter((command) => command[0] === "EVAL").length,
      2
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.KV_REST_API_URL;
  }
});
