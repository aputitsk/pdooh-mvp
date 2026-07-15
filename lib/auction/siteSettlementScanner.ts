"use client";

import { createPendingSettlementRecords } from "@/lib/accounting/accountingFacade";
import {
  createBrowserSettlementRepository,
  type SettlementRepository,
} from "@/lib/accounting/settlementRepository";
import { notifySettlementRecordsChanged } from "@/lib/accounting/settlementRecordSync";
import {
  markSettlementFailedRetryable,
  markSettlementFailedTerminal,
  markSettlementProcessing,
  markSettlementReadyToSettle,
  markSettlementSettled,
  isV2SettlementRecord,
  type SettlementRecord,
} from "@/lib/accounting/settlementRecords";
import {
  isRetryableFailedSettlementRecord,
  MISSING_BID_AUTHORIZATION_FAILURE_REASON,
} from "@/lib/accounting/unresolvedSettlementReservedAmount";
import { ARC_TREASURY_ADDRESS } from "@/lib/arc/arcConfig";
import {
  ARC_CHAIN_ID,
  ARC_USDC_CONTRACT_ADDRESS,
} from "@/lib/arc/arcConstants";
import { getArcEscrowAddress } from "@/lib/arc/arcEscrowConfig";
import { syncAuctionCycle } from "./auctionActions";
import {
  getStoredAdvertisements,
  getStoredSlotStates,
  getStoredSubmittedBids,
} from "./auctionStorage";
import { getAuctionClock } from "./auctionTimer";
import { getSettlementEligibleLiveSlotIds } from "./liveSlotCompletion";
import { selectAuctionWinners } from "./auctionWinners";
import { SITE_CONFIGS } from "./siteConfig";
import { syncTemporaryAuctionReservations } from "./temporaryReservations";
import type { SiteConfig } from "./auctionTypes";

type OperatorProcessResponse = {
  ok: boolean;
  code?: string;
  status?: "settled";
  transactionHash?: `0x${string}`;
  error?: string;
};

const PROCESSING_SETTLEMENT_RETRY_AFTER_MS = 30_000;
const SETTLEMENT_PROCESSING_LEASE_MS = 15_000;
const SETTLEMENT_PROCESSING_LEASE_KEY_PREFIX =
  "pdooh-accounting-settlement-lease:";
const TERMINAL_OPERATOR_ERROR_CODES = new Set([
  "INVALID_REQUEST",
  "INVALID_BID_AUTHORIZATION",
  "BID_AUTHORIZATION_EXPIRED",
  "BID_AUTHORIZATION_SIGNER_MISMATCH",
  "INVALID_BID_AUTHORIZATION_SIGNATURE",
  "SETTLEMENT_RESULT_MISMATCH",
  "SETTLEMENT_ID_MISMATCH",
  "BID_DID_NOT_BEAT_DEMO_BOT",
  "INVALID_SLOT",
  "SETTLEMENT_CONFIG_MISMATCH",
  "UNKNOWN_SITE",
]);

type SettlementProcessingLease = {
  ownerId: string;
  expiresAtMs: number;
};

let settlementProcessingLeaseOwnerId: string | null = null;
let isSettlementProcessingLeaseCleanupRegistered = false;
const activeSettlementProcessingLeaseIds = new Set<`0x${string}`>();

function getSettlementProcessingLeaseOwnerId() {
  if (settlementProcessingLeaseOwnerId) {
    return settlementProcessingLeaseOwnerId;
  }

  settlementProcessingLeaseOwnerId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}:${Math.random()}`;

  return settlementProcessingLeaseOwnerId;
}

function getSettlementProcessingLeaseKey(settlementId: `0x${string}`) {
  return `${SETTLEMENT_PROCESSING_LEASE_KEY_PREFIX}${settlementId.toLowerCase()}`;
}

function registerSettlementProcessingLeaseCleanup() {
  if (
    typeof window === "undefined" ||
    isSettlementProcessingLeaseCleanupRegistered
  ) {
    return;
  }

  isSettlementProcessingLeaseCleanupRegistered = true;
  window.addEventListener("pagehide", () => {
    [...activeSettlementProcessingLeaseIds].forEach((settlementId) => {
      releaseSettlementProcessingLease(settlementId);
    });
  });
}

function readSettlementProcessingLease(
  key: string
): SettlementProcessingLease | null {
  try {
    const value = window.localStorage.getItem(key);

    if (!value) {
      return null;
    }

    const lease = JSON.parse(value) as Partial<SettlementProcessingLease>;

    if (
      typeof lease.ownerId !== "string" ||
      typeof lease.expiresAtMs !== "number" ||
      !Number.isFinite(lease.expiresAtMs)
    ) {
      return null;
    }

    return {
      ownerId: lease.ownerId,
      expiresAtMs: lease.expiresAtMs,
    };
  } catch {
    return null;
  }
}

function tryAcquireSettlementProcessingLease(settlementId: `0x${string}`) {
  if (typeof window === "undefined") {
    return false;
  }

  registerSettlementProcessingLeaseCleanup();

  const key = getSettlementProcessingLeaseKey(settlementId);
  const ownerId = getSettlementProcessingLeaseOwnerId();
  const nowMs = Date.now();
  const currentLease = readSettlementProcessingLease(key);

  if (
    currentLease &&
    currentLease.ownerId !== ownerId &&
    currentLease.expiresAtMs > nowMs
  ) {
    return false;
  }

  const nextLease: SettlementProcessingLease = {
    ownerId,
    expiresAtMs: nowMs + SETTLEMENT_PROCESSING_LEASE_MS,
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(nextLease));
  } catch {
    return true;
  }

  const storedLease = readSettlementProcessingLease(key);

  const isAcquired =
    storedLease?.ownerId === ownerId &&
    storedLease.expiresAtMs === nextLease.expiresAtMs;

  if (isAcquired) {
    activeSettlementProcessingLeaseIds.add(settlementId);
  }

  return isAcquired;
}

function releaseSettlementProcessingLease(settlementId: `0x${string}`) {
  if (typeof window === "undefined") {
    return;
  }

  const key = getSettlementProcessingLeaseKey(settlementId);
  const ownerId = getSettlementProcessingLeaseOwnerId();
  const currentLease = readSettlementProcessingLease(key);

  if (currentLease?.ownerId !== ownerId) {
    activeSettlementProcessingLeaseIds.delete(settlementId);
    return;
  }

  window.localStorage.removeItem(key);
  activeSettlementProcessingLeaseIds.delete(settlementId);
}

function serializeSettlementRecord(record: SettlementRecord) {
  return {
    ...record,
    result: {
      ...record.result,
      amountMinorUnits: record.result.amountMinorUnits.toString(),
    },
  };
}

function markMissingBidAuthorization(record: SettlementRecord): SettlementRecord {
  return markSettlementFailedTerminal(
    record,
    MISSING_BID_AUTHORIZATION_FAILURE_REASON,
    new Date().toISOString()
  );
}

function isConfiguredSiteSettlementRecord(record: SettlementRecord) {
  return getSettlementRecordSiteConfig(record) !== null;
}

function getSettlementRecordSiteConfig(record: SettlementRecord) {
  if (!isV2SettlementRecord(record)) {
    return null;
  }

  return (
    SITE_CONFIGS.find(
      (siteConfig) =>
        siteConfig.marketId === record.result.marketId &&
        siteConfig.siteId === record.result.siteId
    ) ?? null
  );
}

export function isStaleProcessingSettlementRecord(
  record: SettlementRecord,
  nowMs = Date.now()
) {
  if (record.status !== "processing") {
    return false;
  }

  const updatedAtMs = Date.parse(record.updatedAt);

  return (
    Number.isFinite(updatedAtMs) &&
    nowMs - updatedAtMs >= PROCESSING_SETTLEMENT_RETRY_AFTER_MS
  );
}

function isSettlementRecordEligibleForProcessing(record: SettlementRecord) {
  const siteConfig = getSettlementRecordSiteConfig(record);

  if (!siteConfig) {
    return false;
  }

  const clock = getAuctionClock(siteConfig.auctionStartTimestampMs);

  if (String(clock.cycleId) !== record.result.cycleId) {
    return false;
  }

  return getSettlementEligibleLiveSlotIds(
    clock,
    siteConfig.slotIds
  ).some((slotId) => slotId === record.result.slotId);
}

export function hasSettlementPlaybackReached(record: SettlementRecord) {
  const siteConfig = getSettlementRecordSiteConfig(record);

  if (!siteConfig) {
    return false;
  }

  const recordCycleId = Number(record.result.cycleId);

  if (!Number.isSafeInteger(recordCycleId)) {
    return false;
  }

  const clock = getAuctionClock(siteConfig.auctionStartTimestampMs);

  if (clock.cycleId > recordCycleId) {
    return true;
  }

  if (clock.cycleId < recordCycleId) {
    return false;
  }

  return isSettlementRecordEligibleForProcessing(record);
}

function isProcessableSettlementRecord(record: SettlementRecord) {
  return (
    record.status === "ready_to_settle" ||
    isRetryableFailedSettlementRecord(record) ||
    isStaleProcessingSettlementRecord(record)
  );
}

function promoteSettlementRecordIfReady(
  repository: SettlementRepository,
  record: SettlementRecord,
  nowIso: string
) {
  if (record.status !== "pending_playback") {
    return record;
  }

  if (!hasSettlementPlaybackReached(record)) {
    return record;
  }

  const readyRecord = markSettlementReadyToSettle(record, nowIso);
  repository.update(readyRecord);
  notifySettlementRecordsChanged();
  return readyRecord;
}

export function recoverStaleProcessingSettlementRecord(
  repository: SettlementRepository,
  record: SettlementRecord,
  nowIso: string
) {
  if (!isStaleProcessingSettlementRecord(record)) {
    return record;
  }

  const readyRecord = markSettlementReadyToSettle(record, nowIso);
  repository.update(readyRecord);
  notifySettlementRecordsChanged();
  return readyRecord;
}

function isTerminalOperatorError(code: string | undefined) {
  return Boolean(code && TERMINAL_OPERATOR_ERROR_CODES.has(code));
}

function syncSiteAuctionAndCreateSettlementRecords(params: {
  siteConfig: SiteConfig;
  escrowAddress: `0x${string}` | null;
  walletAddress: string | null;
  nowIso: string;
}): SettlementRecord[] {
  const { siteConfig, escrowAddress, walletAddress, nowIso } = params;
  const clock = getAuctionClock(siteConfig.auctionStartTimestampMs);
  syncAuctionCycle(clock, siteConfig.siteKey);

  const slotStates = getStoredSlotStates(siteConfig.siteKey);
  const submittedBids = getStoredSubmittedBids(siteConfig.siteKey);
  const {
    winners,
    winnerBidAmounts,
    winnerAdvertiserAddresses,
    winnerBidAuthorizations,
  } = selectAuctionWinners({
    slotStates,
    submittedBids,
    advertisements: getStoredAdvertisements(walletAddress),
  });

  syncTemporaryAuctionReservations({
    siteKey: siteConfig.siteKey,
    clock,
    slotStates,
    submittedBids,
    winners,
    winnerBidAmounts,
    winnerAdvertiserAddresses,
  });

  const settlementRecords =
    escrowAddress && (clock.phase === "locked" || clock.phase === "live")
      ? createPendingSettlementRecords({
          snapshot: {
            phase: clock.phase,
            cycleId: clock.cycleId,
            chainId: ARC_CHAIN_ID,
            escrowAddress,
            treasuryAddress: ARC_TREASURY_ADDRESS,
            usdcAddress: ARC_USDC_CONTRACT_ADDRESS,
            marketId: siteConfig.marketId,
            siteId: siteConfig.siteId,
            slotIds: siteConfig.slotIds,
            winners,
            winnerBidAmounts,
            winnerAdvertiserAddresses,
            winnerBidAuthorizations,
          },
          nowIso,
        })
      : [];

  return settlementRecords;
}

async function processSettlementRecord(
  repository: SettlementRepository,
  record: SettlementRecord
) {
  if (!isProcessableSettlementRecord(record)) {
    return;
  }

  if (!isConfiguredSiteSettlementRecord(record)) {
    return;
  }

  if (!hasSettlementPlaybackReached(record)) {
    return;
  }

  if (!record.result.bidAuthorization) {
    repository.update(markMissingBidAuthorization(record));
    notifySettlementRecordsChanged();
    return;
  }

  if (!tryAcquireSettlementProcessingLease(record.settlementId)) {
    return;
  }

  try {
    const latestRecord = repository.getById(record.settlementId);

    if (
      latestRecord?.status === "settled" ||
      latestRecord?.status === "failed_terminal" ||
      latestRecord?.status === "pending_playback" ||
      (latestRecord?.status === "processing" &&
        !isStaleProcessingSettlementRecord(latestRecord)) ||
      (latestRecord?.status === "failed_retryable" &&
        !isRetryableFailedSettlementRecord(latestRecord))
    ) {
      return;
    }

    const processingRecord =
      latestRecord?.status === "processing"
        ? latestRecord
        : markSettlementProcessing(
            latestRecord ?? record,
            new Date().toISOString()
          );

    if (processingRecord.status !== "processing") {
      return;
    }

    if (processingRecord !== latestRecord) {
      repository.update(processingRecord);
      notifySettlementRecordsChanged();
    }

    try {
      const response = await fetch("/api/operator/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeSettlementRecord(processingRecord)),
      });
      const result = (await response.json()) as OperatorProcessResponse;

      if (
        !response.ok ||
        !result.ok ||
        result.status !== "settled"
      ) {
        if (isTerminalOperatorError(result.code)) {
          repository.update(
            markSettlementFailedTerminal(
              processingRecord,
              result.error || "Settlement processing failed permanently.",
              new Date().toISOString()
            )
          );
          notifySettlementRecordsChanged();
          return;
        }

        throw new Error(result.error || "Settlement processing failed.");
      }

      const currentRecord = repository.getById(processingRecord.settlementId);
      const transactionHash =
        result.transactionHash ?? currentRecord?.txHash ?? processingRecord.txHash;

      repository.update(
        markSettlementSettled(
          processingRecord,
          transactionHash,
          new Date().toISOString()
        )
      );

      notifySettlementRecordsChanged();
    } catch (error) {
      repository.update(
        markSettlementFailedRetryable(
          processingRecord,
          error instanceof Error ? error.message : "Settlement processing failed.",
          new Date().toISOString()
        )
      );
      notifySettlementRecordsChanged();
    }
  } finally {
    releaseSettlementProcessingLease(record.settlementId);
  }
}

export async function runSiteSettlementScanner(walletAddress: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  let escrowAddress: `0x${string}` | null = null;

  try {
    escrowAddress = getArcEscrowAddress();
  } catch {
    escrowAddress = null;
  }

  const repository = createBrowserSettlementRepository();
  const nowIso = new Date().toISOString();
  const processSettlementTasks: Promise<void>[] = [];
  const queuedSettlementIds = new Set<string>();
  const queueSettlementProcessing = (record: SettlementRecord) => {
    const settlementId = record.settlementId.toLowerCase();

    if (queuedSettlementIds.has(settlementId)) {
      return;
    }

    queuedSettlementIds.add(settlementId);
    processSettlementTasks.push(processSettlementRecord(repository, record));
  };

  SITE_CONFIGS.forEach((siteConfig) => {
    const records = syncSiteAuctionAndCreateSettlementRecords({
      siteConfig,
      escrowAddress,
      walletAddress,
      nowIso,
    });

    records.forEach((record) => {
      if (repository.saveIfAbsent(record)) {
        notifySettlementRecordsChanged();
        queueSettlementProcessing(record);
      }
    });
  });

  repository
    .listByStatus("pending_playback")
    .forEach((record) => {
      const readyRecord = promoteSettlementRecordIfReady(
        repository,
        record,
        nowIso
      );
      queueSettlementProcessing(readyRecord);
    });
  repository
    .listByStatus("ready_to_settle")
    .forEach((record) => {
      queueSettlementProcessing(record);
    });
  repository
    .listByStatus("failed_retryable")
    .filter((record) => isRetryableFailedSettlementRecord(record))
    .forEach((record) => {
      queueSettlementProcessing(record);
    });
  repository
    .listByStatus("processing")
    .filter((record) => isStaleProcessingSettlementRecord(record))
    .map((record) =>
      recoverStaleProcessingSettlementRecord(repository, record, nowIso)
    )
    .forEach((record) => {
      queueSettlementProcessing(record);
    });

  await Promise.all(processSettlementTasks);
}
