import type { FinalizedAuctionResult } from "./settlementRecords";
import type {
  AccountRevenueLastPayment,
  AccountRevenueMemo,
  AccountRevenueSnapshot,
} from "./accountRevenueTypes";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { getVercelKvRedisRestConfig, runRedisCommand, type RedisRestConfig } from "./redisRestStore.ts";

type HexHash = `0x${string}`;

type ApplySettledAccountRevenueParams = {
  result: FinalizedAuctionResult;
  settledAt: string;
  settlementId: HexHash;
  transactionHash: HexHash;
};

const ACCOUNT_REVENUE_TOTAL_KEY_PREFIX = "pdooh:account-revenue:total:";
const ACCOUNT_REVENUE_LAST_KEY_PREFIX = "pdooh:account-revenue:last:";
const ACCOUNT_REVENUE_APPLIED_KEY_PREFIX = "pdooh:account-revenue:applied:";

const APPLY_SETTLED_REVENUE_SCRIPT = `
local appliedKey = KEYS[1]
local totalKey = KEYS[2]
local lastKey = KEYS[3]

if redis.call("EXISTS", appliedKey) == 1 then
  return {0, redis.call("GET", totalKey)}
end

redis.call("SET", appliedKey, ARGV[1])
local total = redis.call("INCRBY", totalKey, ARGV[2])
redis.call("SET", lastKey, ARGV[3])

return {1, tostring(total)}
`;

function normalizeAddress(value: HexHash) {
  return value.toLowerCase() as HexHash;
}

function isHexAddress(value: unknown): value is HexHash {
  return typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getAccountRevenueTotalKey(walletAddress: HexHash) {
  return `${ACCOUNT_REVENUE_TOTAL_KEY_PREFIX}${walletAddress}`;
}

function getAccountRevenueLastKey(walletAddress: HexHash) {
  return `${ACCOUNT_REVENUE_LAST_KEY_PREFIX}${walletAddress}`;
}

function getAppliedSettlementKey(settlementId: HexHash) {
  return `${ACCOUNT_REVENUE_APPLIED_KEY_PREFIX}${settlementId}`;
}

function isSafePositiveBigIntString(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value) && BigInt(value) > BigInt(0);
}

function createLastPayment(
  params: ApplySettledAccountRevenueParams
): AccountRevenueLastPayment {
  const { result, settledAt, settlementId, transactionHash } = params;

  return {
    advertisementName: result.advertisementName,
    amountMinorUnits: result.amountMinorUnits.toString(),
    businessName: result.businessName,
    chainId: result.chainId,
    cycleId: result.cycleId,
    escrowAddress: normalizeAddress(result.escrowAddress),
    marketId: result.marketId,
    settlementId: normalizeAddress(settlementId),
    settledAt,
    siteId: result.siteId,
    slotId: result.slotId,
    status: "settled",
    transactionHash: normalizeAddress(transactionHash),
  };
}

function createLastMemo(
  params: ApplySettledAccountRevenueParams
): AccountRevenueMemo {
  const { result, settlementId } = params;

  return {
    ad: result.advertisementName,
    advertiser: normalizeAddress(result.advertiserAddress),
    amountMinor: result.amountMinorUnits.toString(),
    company: result.businessName,
    cycleId: result.cycleId,
    marketId: result.marketId,
    settlementId: normalizeAddress(settlementId),
    siteId: result.siteId,
    slotId: result.slotId,
    type: "pdooh.settlement",
  };
}

function parseLastPayment(value: unknown): AccountRevenueLastPayment | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const payment = value as Partial<AccountRevenueLastPayment>;
  const advertisementName = payment.advertisementName;
  const amountMinorUnits = payment.amountMinorUnits;
  const businessName = payment.businessName;
  const chainId = payment.chainId;
  const cycleId = payment.cycleId;
  const escrowAddress = payment.escrowAddress;
  const marketId = payment.marketId;
  const settlementId = payment.settlementId;
  const settledAt = payment.settledAt;
  const siteId = payment.siteId;
  const slotId = payment.slotId;
  const transactionHash = payment.transactionHash;

  if (
    !isNonEmptyString(advertisementName) ||
    !isSafePositiveBigIntString(amountMinorUnits) ||
    !isNonEmptyString(businessName) ||
    typeof chainId !== "number" ||
    !isNonEmptyString(cycleId) ||
    !isHexAddress(escrowAddress) ||
    !isNonEmptyString(marketId) ||
    !isHexAddress(settlementId) ||
    !isNonEmptyString(settledAt) ||
    !isNonEmptyString(siteId) ||
    !isNonEmptyString(slotId) ||
    payment.status !== "settled" ||
    !isHexAddress(transactionHash)
  ) {
    return null;
  }

  return {
    advertisementName,
    amountMinorUnits,
    businessName,
    chainId,
    cycleId,
    escrowAddress: normalizeAddress(escrowAddress),
    marketId,
    settlementId: normalizeAddress(settlementId),
    settledAt,
    siteId,
    slotId,
    status: "settled",
    transactionHash: normalizeAddress(transactionHash),
  };
}

function parseLastMemo(value: unknown): AccountRevenueMemo | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const memo = value as Partial<AccountRevenueMemo>;
  const ad = memo.ad;
  const advertiser = memo.advertiser;
  const amountMinor = memo.amountMinor;
  const company = memo.company;
  const cycleId = memo.cycleId;
  const marketId = memo.marketId;
  const settlementId = memo.settlementId;
  const siteId = memo.siteId;
  const slotId = memo.slotId;

  if (
    memo.type !== "pdooh.settlement" ||
    !isHexAddress(settlementId) ||
    !isNonEmptyString(marketId) ||
    !isNonEmptyString(siteId) ||
    !isNonEmptyString(cycleId) ||
    !isNonEmptyString(slotId) ||
    !isHexAddress(advertiser) ||
    !isNonEmptyString(company) ||
    !isNonEmptyString(ad) ||
    !isSafePositiveBigIntString(amountMinor)
  ) {
    return null;
  }

  return {
    ad,
    advertiser: normalizeAddress(advertiser),
    amountMinor,
    company,
    cycleId,
    marketId,
    settlementId: normalizeAddress(settlementId),
    siteId,
    slotId,
    type: "pdooh.settlement",
  };
}

function parseLastPayload(value: unknown) {
  if (typeof value !== "string") {
    return {
      lastMemo: null,
      lastPayment: null,
    };
  }

  try {
    const payload = JSON.parse(value) as Partial<{
      lastMemo: unknown;
      lastPayment: unknown;
    }>;

    return {
      lastMemo: parseLastMemo(payload.lastMemo),
      lastPayment: parseLastPayment(payload.lastPayment),
    };
  } catch {
    return {
      lastMemo: null,
      lastPayment: null,
    };
  }
}

function parseTotal(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return "0";
  }

  return value;
}

async function getRedisAccountRevenueSnapshot(
  config: RedisRestConfig,
  walletAddress: HexHash
): Promise<AccountRevenueSnapshot | null> {
  const [totalResult, lastResult] = await Promise.all([
    runRedisCommand(config, ["GET", getAccountRevenueTotalKey(walletAddress)]),
    runRedisCommand(config, ["GET", getAccountRevenueLastKey(walletAddress)]),
  ]);
  const totalAmountMinorUnits = parseTotal(totalResult);
  const { lastMemo, lastPayment } = parseLastPayload(lastResult);

  if (totalAmountMinorUnits === "0" && !lastPayment) {
    return null;
  }

  return {
    lastMemo,
    lastPayment,
    schemaVersion: 1,
    totalAmountMinorUnits,
    walletAddress,
  };
}

async function applyRedisSettledAccountRevenue(
  config: RedisRestConfig,
  params: ApplySettledAccountRevenueParams
) {
  const walletAddress = normalizeAddress(params.result.advertiserAddress);
  const settlementId = normalizeAddress(params.settlementId);
  const appliedValue = JSON.stringify({
    amountMinorUnits: params.result.amountMinorUnits.toString(),
    transactionHash: normalizeAddress(params.transactionHash),
    walletAddress,
  });
  const lastPayload = JSON.stringify({
    lastMemo: createLastMemo(params),
    lastPayment: createLastPayment(params),
  });

  await runRedisCommand(config, [
    "EVAL",
    APPLY_SETTLED_REVENUE_SCRIPT,
    "3",
    getAppliedSettlementKey(settlementId),
    getAccountRevenueTotalKey(walletAddress),
    getAccountRevenueLastKey(walletAddress),
    appliedValue,
    params.result.amountMinorUnits.toString(),
    lastPayload,
  ]);
}

export async function getAccountRevenueSnapshot(walletAddress: HexHash) {
  const redisConfig = getVercelKvRedisRestConfig();

  if (!redisConfig) {
    return null;
  }

  return getRedisAccountRevenueSnapshot(
    redisConfig,
    normalizeAddress(walletAddress)
  );
}

export async function applySettledAccountRevenue(
  params: ApplySettledAccountRevenueParams
) {
  const redisConfig = getVercelKvRedisRestConfig();

  if (!redisConfig) {
    return;
  }

  await applyRedisSettledAccountRevenue(redisConfig, params);
}
