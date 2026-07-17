import {
  encodeAbiParameters,
  keccak256,
  stringToHex,
} from "viem";

import type { SiteKey } from "../../auction/auctionTypes";
import type { ContractV1Bytes32 } from "./types";

export const CONTRACT_V1_SITE_ID_DOMAIN_NAME = "pdooh.siteId.v1";
export const CONTRACT_V1_SITE_ID_DOMAIN = keccak256(
  stringToHex(CONTRACT_V1_SITE_ID_DOMAIN_NAME)
) as ContractV1Bytes32;

export const CONTRACT_V1_CANONICAL_SITE_KEYS = [
  "new-york/times-square",
  "los-angeles/hollywood-boulevard",
] as const satisfies readonly SiteKey[];

export const CONTRACT_V1_SITE_ID_TEST_VECTORS = [
  {
    siteKey: "new-york/times-square",
    siteId:
      "0x8cf3e0bc4b551deafc95cab2f38acbf1eae9a58ab3a8fe8b6be5bf3279331672",
    configuredOnArcTestnet: true,
  },
  {
    siteKey: "los-angeles/hollywood-boulevard",
    siteId:
      "0xeafcd6dbd8ec28ca540b1bd01c1b86bfcf3cd652b4d75e9ce14f8683c1781bfe",
    configuredOnArcTestnet: false,
  },
] as const satisfies readonly {
  siteKey: SiteKey;
  siteId: ContractV1Bytes32;
  configuredOnArcTestnet: boolean;
}[];

const contractV1CanonicalSiteKeySet = new Set<string>(
  CONTRACT_V1_CANONICAL_SITE_KEYS
);

export function getContractV1CanonicalSiteKey(siteKey: string): SiteKey {
  const trimmedSiteKey = siteKey.trim();

  if (!contractV1CanonicalSiteKeySet.has(trimmedSiteKey)) {
    throw new Error(
      `Unknown Contract V1 site key "${siteKey}". Use the app siteKey, for example "new-york/times-square".`
    );
  }

  return trimmedSiteKey as SiteKey;
}

export function getContractV1SiteId(siteKey: string): ContractV1Bytes32 {
  const canonicalSiteKey = getContractV1CanonicalSiteKey(siteKey);

  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "string" }],
      [CONTRACT_V1_SITE_ID_DOMAIN, canonicalSiteKey]
    )
  ) as ContractV1Bytes32;
}
