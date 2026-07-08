"use client";

import { createPendingSettlementRecords } from "@/lib/accounting/accountingFacade";
import {
  createBrowserSettlementRepository,
  type SettlementRepository,
} from "@/lib/accounting/settlementRepository";
import { notifySettlementRecordsChanged } from "@/lib/accounting/settlementRecordSync";
import {
  markSettlementCancelled,
  markSettlementFailed,
  markSettlementAlreadySettled,
  markSettlementProcessing,
  markSettlementSettled,
  isV2SettlementRecord,
  type SettlementRecord,
} from "@/lib/accounting/settlementRecords";
import {
  isRetryableFailedSettlementRecord,
  MISSING_BID_AUTHORIZATION_FAILURE_REASON,
  SETTLEMENT_WINDOW_CLOSED_FAILURE_REASON,
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
  status?: "settled" | "already_settled";
  transactionHash?: `0x${string}`;
  error?: string;
};

const PROCESSING_SETTLEMENT_RETRY_AFTER_MS = 30_000;
const SETTLEMENT_PROCESSING_LEASE_MS = 90_000;
const SETTLEMENT_PROCESSING_LEASE_KEY_PREFIX =
  "pdooh-accounting-settlement-lease:";

type SettlementProcessingLease = {
  ownerId: string;
  expiresAtMs: number;
};

let settlementProcessingLeaseOwnerId: string | null = null;

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

  return (
    storedLease?.ownerId === ownerId &&
    storedLease.expiresAtMs === nextLease.expiresAtMs
  );
}

function releaseSettlementProcessingLease(settlementId: `0x${string}`) {
  if (typeof window === "undefined") {
    return;
  }

  const key = getSettlementProcessingLeaseKey(settlementId);
  const ownerId = getSettlementProcessingLeaseOwnerId();
  const currentLease = readSettlementProcessingLease(key);

  if (currentLease?.ownerId !== ownerId) {
    return;
  }

  window.localStorage.removeItem(key);
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
  return {
    ...record,
    status: "failed",
    updatedAt: new Date().toISOString(),
    failureReason: MISSING_BID_AUTHORIZATION_FAILURE_REASON,
  };
}

function isConfiguredSiteSettlementRecord(record: SettlementRecord) {
  return (
    isV2SettlementRecord(record) &&
    SITE_CONFIGS.some(
      (siteConfig) =>
        siteConfig.marketId === record.result.marketId &&
        siteConfig.siteId === record.result.siteId
    )
  );
}

function isStaleProcessingSettlementRecord(
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

function isProcessableSettlementRecord(record: SettlementRecord) {
  return (
    record.status === "pending" ||
    isRetryableFailedSettlementRecord(record) ||
    isStaleProcessingSettlementRecord(record)
  );
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

  if (!escrowAddress || clock.phase !== "live") {
    return [];
  }

  const settlementEligibleSlotIds = getSettlementEligibleLiveSlotIds(
    clock,
    siteConfig.slotIds
  );

  if (settlementEligibleSlotIds.length === 0) {
    return [];
  }

  return createPendingSettlementRecords({
    snapshot: {
      phase: clock.phase,
      cycleId: clock.cycleId,
      chainId: ARC_CHAIN_ID,
      escrowAddress,
      treasuryAddress: ARC_TREASURY_ADDRESS,
      usdcAddress: ARC_USDC_CONTRACT_ADDRESS,
      marketId: siteConfig.marketId,
      siteId: siteConfig.siteId,
      slotIds: settlementEligibleSlotIds,
      winners,
      winnerBidAmounts,
      winnerAdvertiserAddresses,
      winnerBidAuthorizations,
    },
    nowIso,
  });
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
      latestRecord?.status === "already_settled" ||
      latestRecord?.status === "cancelled" ||
      (latestRecord?.status === "processing" &&
        !isStaleProcessingSettlementRecord(latestRecord)) ||
      (latestRecord?.status === "failed" &&
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
        (result.status !== "settled" && result.status !== "already_settled")
      ) {
        if (result.code === "SETTLEMENT_WINDOW_NOT_OPEN") {
          repository.update(
            markSettlementCancelled(
              processingRecord,
              SETTLEMENT_WINDOW_CLOSED_FAILURE_REASON,
              new Date().toISOString()
            )
          );
          notifySettlementRecordsChanged();
          return;
        }

        throw new Error(result.error || "Settlement processing failed.");
      }

      if (result.status === "already_settled" && !result.transactionHash) {
        const currentRecord = repository.getById(processingRecord.settlementId);

        if (currentRecord?.status !== "settled" || !currentRecord.txHash) {
          repository.update(
            markSettlementAlreadySettled(
              processingRecord,
              new Date().toISOString()
            )
          );
        }
      } else if (result.transactionHash) {
        repository.update(
          markSettlementSettled(
            processingRecord,
            result.transactionHash,
            new Date().toISOString()
          )
        );
      } else {
        throw new Error("Settlement transaction hash is missing.");
      }

      notifySettlementRecordsChanged();
    } catch (error) {
      repository.update(
        markSettlementFailed(
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
    .listByStatus("pending")
    .forEach((record) => {
      queueSettlementProcessing(record);
    });
  repository
    .listByStatus("failed")
    .filter(isRetryableFailedSettlementRecord)
    .forEach((record) => {
      queueSettlementProcessing(record);
    });
  repository
    .listByStatus("processing")
    .filter((record) => isStaleProcessingSettlementRecord(record))
    .forEach((record) => {
      queueSettlementProcessing(record);
    });

  await Promise.all(processSettlementTasks);
}
