import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { CONTRACT_V1_CANONICAL_SITE_KEYS, CONTRACT_V1_SITE_ID_DOMAIN, CONTRACT_V1_SITE_ID_TEST_VECTORS, getContractV1CanonicalSiteKey, getContractV1SiteId } from "./siteIds.ts";

function readApplicationSiteKeys() {
  const siteConfigSource = readFileSync(
    new URL("../../auction/siteConfig.ts", import.meta.url),
    "utf8"
  );
  const siteKeys = new Set<string>();

  for (const match of siteConfigSource.matchAll(/siteKey:\s*"([^"]+)"/g)) {
    siteKeys.add(match[1]);
  }

  return [...siteKeys].sort();
}

test("Contract V1 site ids match AuctionIds vectors", () => {
  assert.equal(
    CONTRACT_V1_SITE_ID_DOMAIN,
    "0x28dded5f4ff9e9d3da943c4c321dfbeca9987b356600fff32caed79e23415c31"
  );

  for (const vector of CONTRACT_V1_SITE_ID_TEST_VECTORS) {
    assert.equal(getContractV1SiteId(vector.siteKey), vector.siteId);
  }
});

test("Contract V1 site ids use exact app siteKey strings", () => {
  assert.equal(
    getContractV1CanonicalSiteKey("new-york/times-square"),
    "new-york/times-square"
  );
  assert.throws(
    () => getContractV1CanonicalSiteKey("New York / Times Square"),
    /Unknown Contract V1 site key/
  );
});

test("Contract V1 vectors cover every real application site key", () => {
  const applicationSiteKeys = readApplicationSiteKeys();
  const canonicalSiteKeys = [...CONTRACT_V1_CANONICAL_SITE_KEYS].sort();
  const vectorSiteKeys = CONTRACT_V1_SITE_ID_TEST_VECTORS.map(
    (vector) => vector.siteKey
  ).sort();

  assert.deepEqual(applicationSiteKeys, canonicalSiteKeys);
  assert.deepEqual(vectorSiteKeys, canonicalSiteKeys);
});
