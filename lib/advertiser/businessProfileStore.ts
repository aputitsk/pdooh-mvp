import type { AccountBusinessProfile } from "./businessProfileTypes";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { getVercelKvRedisRestConfig, runRedisCommand, type RedisRestConfig } from "../accounting/redisRestStore.ts";

type HexAddress = `0x${string}`;

type SaveBusinessProfileParams = {
  businessName: string;
  updatedAt: string;
  walletAddress: HexAddress;
};

const BUSINESS_PROFILE_KEY_PREFIX = "pdooh:business-profile:";
const BUSINESS_NAME_MAX_LENGTH = 20;

function normalizeAddress(value: HexAddress) {
  return value.toLowerCase() as HexAddress;
}

function getBusinessProfileKey(walletAddress: HexAddress) {
  return `${BUSINESS_PROFILE_KEY_PREFIX}${walletAddress}`;
}

function normalizeBusinessName(value: string) {
  return value.trim().slice(0, BUSINESS_NAME_MAX_LENGTH);
}

function parseBusinessProfile(value: unknown): AccountBusinessProfile | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const profile = JSON.parse(value) as Partial<AccountBusinessProfile>;

    if (
      profile.schemaVersion !== 1 ||
      typeof profile.walletAddress !== "string" ||
      !profile.walletAddress.startsWith("0x") ||
      profile.isBusinessProfileCreated !== true ||
      typeof profile.businessName !== "string" ||
      profile.businessName.trim().length === 0 ||
      typeof profile.updatedAt !== "string" ||
      profile.updatedAt.trim().length === 0
    ) {
      return null;
    }

    return {
      businessName: normalizeBusinessName(profile.businessName),
      isBusinessProfileCreated: true,
      schemaVersion: 1,
      updatedAt: profile.updatedAt,
      walletAddress: normalizeAddress(profile.walletAddress as HexAddress),
    };
  } catch {
    return null;
  }
}

async function getRedisBusinessProfile(
  config: RedisRestConfig,
  walletAddress: HexAddress
) {
  const result = await runRedisCommand(config, [
    "GET",
    getBusinessProfileKey(walletAddress),
  ]);

  return parseBusinessProfile(result);
}

async function saveRedisBusinessProfile(
  config: RedisRestConfig,
  params: SaveBusinessProfileParams
) {
  const walletAddress = normalizeAddress(params.walletAddress);
  const businessName = normalizeBusinessName(params.businessName);

  if (!businessName) {
    return null;
  }

  const profile: AccountBusinessProfile = {
    businessName,
    isBusinessProfileCreated: true,
    schemaVersion: 1,
    updatedAt: params.updatedAt,
    walletAddress,
  };

  await runRedisCommand(config, [
    "SET",
    getBusinessProfileKey(walletAddress),
    JSON.stringify(profile),
  ]);

  return profile;
}

export async function getStoredAccountBusinessProfile(
  walletAddress: HexAddress
) {
  const redisConfig = getVercelKvRedisRestConfig();

  if (!redisConfig) {
    return null;
  }

  return getRedisBusinessProfile(redisConfig, normalizeAddress(walletAddress));
}

export async function saveStoredAccountBusinessProfile(
  params: SaveBusinessProfileParams
) {
  const redisConfig = getVercelKvRedisRestConfig();

  if (!redisConfig) {
    return null;
  }

  return saveRedisBusinessProfile(redisConfig, params);
}
