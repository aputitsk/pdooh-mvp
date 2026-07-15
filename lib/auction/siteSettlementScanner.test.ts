import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createSettlementRepository } from "../accounting/settlementRepository.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createPendingSettlementRecord, markSettlementProcessing, markSettlementReadyToSettle, type FinalizedAuctionResult } from "../accounting/settlementRecords.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createEmptySlotStates, saveAuctionState } from "./auctionStorage.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { AUCTION_OPEN_SECONDS, AUCTION_SELECTING_SECONDS, AUCTION_TOTAL_CYCLE_SECONDS } from "./constants.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { hasSettlementPlaybackReached, recoverStaleProcessingSettlementRecord, runSiteSettlementScanner } from "./siteSettlementScanner.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { SITE_CONFIGS } from "./siteConfig.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { getTemporaryReservedAmount } from "./temporaryReservations.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

async function withBrowserStorage<T>(
  callback: (storage: MemoryStorage) => T | Promise<T>
): Promise<T> {
  const originalWindow = globalThis.window;
  const storage = new MemoryStorage();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      dispatchEvent: () => true,
    },
  });

  try {
    return await callback(storage);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
}

const bidAuthorization = {
  payload: {
    purpose: "PDOOH_BID_AUTHORIZATION",
    version: "2",
    marketId: "new-york",
    siteId: "times-square",
    advertiserAddress: "0x2222222222222222222222222222222222222222",
    businessName: "Acme",
    advertisementName: "Summer Sale",
    slotId: "slot-1",
    cycleId: "7",
    bidAmountMinorUnits: "1500000",
    chainId: 5_042_002,
    escrowAddress: "0x1111111111111111111111111111111111111111",
    treasuryAddress: "0x3333333333333333333333333333333333333333",
    usdcAddress: "0x3600000000000000000000000000000000000000",
    expiresAt: "2026-06-25T12:30:00.000Z",
  },
  signature:
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
} as const;

function createResult(
  overrides: Partial<FinalizedAuctionResult> = {}
): FinalizedAuctionResult {
  return {
    chainId: 5_042_002,
    escrowAddress: "0x1111111111111111111111111111111111111111",
    treasuryAddress: "0x3333333333333333333333333333333333333333",
    usdcAddress: "0x3600000000000000000000000000000000000000",
    marketId: "new-york",
    siteId: "times-square",
    cycleId: "7",
    slotId: "slot-1",
    advertiserAddress: "0x2222222222222222222222222222222222222222",
    businessName: "Acme",
    advertisementName: "Summer Sale",
    amountMinorUnits: BigInt(1_500_000),
    bidAuthorization,
    ...overrides,
  };
}

test("stale processing settlement returns to ready state", () => {
  const repository = createSettlementRepository(new MemoryStorage());
  const pending = createPendingSettlementRecord(
    createResult(),
    "2026-06-25T12:00:00.000Z"
  );
  const ready = markSettlementReadyToSettle(
    pending,
    "2026-06-25T12:00:30.000Z"
  );
  const processing = {
    ...markSettlementProcessing(ready, "2026-06-25T12:01:00.000Z"),
    updatedAt: "2026-06-25T12:01:00.000Z",
  };

  repository.saveIfAbsent(processing);

  const recovered = recoverStaleProcessingSettlementRecord(
    repository,
    processing,
    "2026-06-25T12:02:00.000Z"
  );

  assert.equal(recovered.status, "ready_to_settle");
  assert.equal(
    repository.getById(processing.settlementId)?.status,
    "ready_to_settle"
  );
});

test("site B settlement readiness follows record site identity, not selected UI site", () => {
  const losAngelesSite = SITE_CONFIGS.find(
    (siteConfig) => siteConfig.siteKey === "los-angeles/hollywood-boulevard"
  );

  assert.ok(losAngelesSite);

  const originalDateNow = Date.now;
  Date.now = () =>
    losAngelesSite.auctionStartTimestampMs +
    (AUCTION_TOTAL_CYCLE_SECONDS * 7 +
      AUCTION_OPEN_SECONDS +
      AUCTION_SELECTING_SECONDS +
      4) *
      1000;

  try {
    const record = createPendingSettlementRecord(
      createResult({
        marketId: losAngelesSite.marketId,
        siteId: losAngelesSite.siteId,
        cycleId: "7",
        slotId: "slot-1",
        bidAuthorization: {
          payload: {
            ...bidAuthorization.payload,
            marketId: losAngelesSite.marketId,
            siteId: losAngelesSite.siteId,
            cycleId: "7",
            slotId: "slot-1",
          },
          signature: bidAuthorization.signature,
        },
      }),
      "2026-06-25T12:00:00.000Z"
    );

    assert.equal(hasSettlementPlaybackReached(record), true);
  } finally {
    Date.now = originalDateNow;
  }
});

test("cycle rollover does not create temporary reservations from stale bids", async () => {
  const siteConfig = SITE_CONFIGS[0];
  const advertiserAddress = bidAuthorization.payload.advertiserAddress;
  const originalDateNow = Date.now;

  Date.now = () =>
    siteConfig.auctionStartTimestampMs +
    (AUCTION_TOTAL_CYCLE_SECONDS * 8 + 1) * 1000;

  try {
    await withBrowserStorage(async () => {
      const slotStates = createEmptySlotStates();
      slotStates[0] = {
        selectedAdvertisement: "Summer Sale",
        bid: "1.50",
        advertiserAddress,
        bidAuthorization,
      };

      saveAuctionState(siteConfig.siteKey, {
        auctionCycleId: "7",
        slotStates,
        submittedBids: [true, false, false],
        paidSlots: [true, true, true],
      });

      await runSiteSettlementScanner(advertiserAddress);

      assert.equal(
        getTemporaryReservedAmount(advertiserAddress, siteConfig.siteKey),
        0
      );
    });
  } finally {
    Date.now = originalDateNow;
  }
});
