import assert from "node:assert/strict";
import test from "node:test";

test("business profile store persists a profile by wallet address", async () => {
  const originalFetch = globalThis.fetch;
  const values = new Map<string, string>();
  const walletAddress = "0x1111111111111111111111111111111111111111";

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

    if (command[0] === "GET" && typeof command[1] === "string") {
      return Response.json({ result: values.get(command[1]) ?? null });
    }

    if (
      command[0] === "SET" &&
      typeof command[1] === "string" &&
      typeof command[2] === "string"
    ) {
      values.set(command[1], command[2]);

      return Response.json({ result: "OK" });
    }

    return Response.json({ error: "Unsupported command" }, { status: 400 });
  }) as typeof fetch;

  const storeModule = await import(
    `./businessProfileStore.ts?test=${Date.now()}-${Math.random()}`
  );

  try {
    assert.equal(
      await storeModule.getStoredAccountBusinessProfile(walletAddress),
      null
    );

    await storeModule.saveStoredAccountBusinessProfile({
      businessName: "  Miami Retail Group  ",
      updatedAt: "2026-07-14T20:00:00.000Z",
      walletAddress,
    });

    const profile =
      await storeModule.getStoredAccountBusinessProfile(walletAddress);

    assert.equal(profile?.businessName, "Miami Retail Group");
    assert.equal(profile?.isBusinessProfileCreated, true);
    assert.equal(profile?.walletAddress, walletAddress);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.KV_REST_API_URL;
  }
});
