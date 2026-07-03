"use client";

import { useSyncExternalStore } from "react";

import {
  AUCTION_OPEN_SECONDS,
  AUCTION_PLAYBACK_SECONDS_PER_SLOT,
  AUCTION_SELECTING_SECONDS,
  DEMO_BOT_ADVERTISEMENT,
} from "./constants";
import {
  listBrowserSettlementRecords,
  subscribeToSettlementRecordChanges,
} from "@/lib/accounting/settlementRecordSync";
import {
  SETTLEMENT_IDENTITY_VERSION_V2,
  type SettlementRecord,
} from "@/lib/accounting/settlementRecords";
import { getAuctionSiteStorageKey, getAuctionStart } from "./auctionStorage";
import { getAuctionClock } from "./auctionTimer";
import type {
  Advertisement,
  AuctionClock,
  SiteIdentity,
  SiteKey,
  SignedBidAuthorization,
  SlotState,
} from "./auctionTypes";
import {
  DEFAULT_SITE_KEY,
  LOS_ANGELES_HOLLYWOOD_BOULEVARD_SITE_KEY,
  NEW_YORK_TIMES_SQUARE_SITE_KEY,
  SITE_CONFIGS,
  getSiteConfig,
} from "./siteConfig";
import {
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

type TemporaryAuctionReservation = SiteIdentity & {
  advertiserAddress: string;
  cycleId: number;
  slotIndex: number;
  amount: UsdcMinorUnits;
};

export type TemporaryReservedAmountBySite = {
  siteKey: SiteKey;
  reservedAmount: UsdcMinorUnits;
};

export type SharedEscrowTemporaryReservedAmounts = {
  bySite: TemporaryReservedAmountBySite[];
  totalReservedAmount: UsdcMinorUnits;
};

type ReserveFinalizedWinnersParams = {
  siteKey?: SiteKey;
  clock: AuctionClock;
  slotStates: SlotState[];
  submittedBids: boolean[];
  winners: Advertisement[];
  winnerBidAmounts: UsdcMinorUnits[];
  winnerAdvertiserAddresses: (`0x${string}` | null)[];
};

const reservationChangedEventName =
  "pdooh-temporary-auction-reservations-change";

function isBrowser() {
  return typeof window !== "undefined";
}

function getSiteIdentity(siteKey: SiteKey): SiteIdentity {
  const site = getSiteConfig(siteKey);

  return {
    marketId: site.marketId,
    siteId: site.siteId,
    siteKey: site.siteKey,
  };
}

function getStoredReservations(
  siteKey: SiteKey = DEFAULT_SITE_KEY
): TemporaryAuctionReservation[] {
  if (!isBrowser()) {
    return [];
  }

  const stored = window.localStorage.getItem(
    getAuctionSiteStorageKey(siteKey, "temporaryReservations")
  );

  if (!stored) {
    return [];
  }

  try {
    const reservations = JSON.parse(stored) as unknown;

    if (!Array.isArray(reservations)) {
      return [];
    }

    return reservations.filter(
      (reservation): reservation is TemporaryAuctionReservation => {
        if (typeof reservation !== "object" || reservation === null) {
          return false;
        }

        const candidate = reservation as Partial<TemporaryAuctionReservation>;

        return (
          typeof candidate.marketId === "string" &&
          typeof candidate.siteId === "string" &&
          typeof candidate.siteKey === "string" &&
          typeof candidate.advertiserAddress === "string" &&
          Number.isSafeInteger(candidate.cycleId) &&
          Number.isSafeInteger(candidate.slotIndex) &&
          Number.isSafeInteger(candidate.amount) &&
          (candidate.amount ?? 0) > 0
        );
      }
    );
  } catch {
    return [];
  }
}

function setStoredReservations(
  reservations: TemporaryAuctionReservation[],
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    getAuctionSiteStorageKey(siteKey, "temporaryReservations"),
    JSON.stringify(reservations)
  );
  window.dispatchEvent(new Event(reservationChangedEventName));
}

function getReservationKey(reservation: TemporaryAuctionReservation) {
  return [
    reservation.siteKey,
    reservation.advertiserAddress.toLowerCase(),
    reservation.cycleId,
    reservation.slotIndex,
  ].join(":");
}

function getSlotId(slotIndex: number) {
  return `slot-${slotIndex + 1}`;
}

function getAuthorizedBidAmount(
  bidAuthorization: SignedBidAuthorization | undefined
): UsdcMinorUnits | null {
  const value = bidAuthorization?.payload.bidAmountMinorUnits;

  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const amount = BigInt(value);

  if (amount <= BigInt(0) || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return Number(amount);
}

function getBidAmount(bid: string | undefined): UsdcMinorUnits {
  if (!bid) {
    return 0;
  }

  try {
    return parseUSDCToMinorUnits(bid);
  } catch {
    return 0;
  }
}

function addSafeMinorUnits(
  current: UsdcMinorUnits,
  amount: UsdcMinorUnits
): UsdcMinorUnits {
  const next = current + amount;
  return Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
}

function isReservationActive(
  reservation: TemporaryAuctionReservation,
  clock: AuctionClock
) {
  if (reservation.cycleId !== clock.cycleId) {
    return false;
  }

  const slotEndTime =
    AUCTION_OPEN_SECONDS +
    AUCTION_SELECTING_SECONDS +
    AUCTION_PLAYBACK_SECONDS_PER_SLOT * (reservation.slotIndex + 1);

  return clock.elapsedInCycle < slotEndTime;
}

function isSettlementBackedReservation(
  reservation: TemporaryAuctionReservation,
  settlementRecords: readonly SettlementRecord[]
) {
  return settlementRecords.some((record) => {
    return (
      (record.identityVersion !== SETTLEMENT_IDENTITY_VERSION_V2 ||
        (record.result.marketId === reservation.marketId &&
          record.result.siteId === reservation.siteId)) &&
      record.result.advertiserAddress.toLowerCase() ===
        reservation.advertiserAddress.toLowerCase() &&
      record.result.cycleId === String(reservation.cycleId) &&
      record.result.slotId === getSlotId(reservation.slotIndex) &&
      record.result.amountMinorUnits === BigInt(reservation.amount)
    );
  });
}

function createSubmittedBidReservations(params: {
  siteIdentity: SiteIdentity;
  clock: AuctionClock;
  slotStates: SlotState[];
  submittedBids: boolean[];
}): TemporaryAuctionReservation[] {
  const { clock, siteIdentity, slotStates, submittedBids } = params;

  if (clock.phase !== "open") {
    return [];
  }

  return slotStates.flatMap((slot, slotIndex) => {
    if (!submittedBids[slotIndex]) {
      return [];
    }

    const advertiserAddress =
      slot.bidAuthorization?.payload.advertiserAddress ??
      slot.advertiserAddress;
    const amount =
      getAuthorizedBidAmount(slot.bidAuthorization) ?? getBidAmount(slot.bid);

    if (!advertiserAddress || !Number.isSafeInteger(amount) || amount <= 0) {
      return [];
    }

    return [
      {
        ...siteIdentity,
        advertiserAddress,
        cycleId: clock.cycleId,
        slotIndex,
        amount,
      },
    ];
  });
}

function createFinalizedWinnerReservations(params: {
  siteIdentity: SiteIdentity;
  clock: AuctionClock;
  winners: Advertisement[];
  winnerBidAmounts: UsdcMinorUnits[];
  winnerAdvertiserAddresses: (`0x${string}` | null)[];
}): TemporaryAuctionReservation[] {
  const {
    clock,
    siteIdentity,
    winners,
    winnerBidAmounts,
    winnerAdvertiserAddresses,
  } = params;

  if (clock.phase !== "locked" && clock.phase !== "live") {
    return [];
  }

  return winners.flatMap((winner, slotIndex) => {
    const amount = winnerBidAmounts[slotIndex] ?? 0;
    const advertiserAddress = winnerAdvertiserAddresses[slotIndex];

    if (
      !advertiserAddress ||
      winner.businessName === DEMO_BOT_ADVERTISEMENT.businessName ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      return [];
    }

    return [
      {
        ...siteIdentity,
        advertiserAddress,
        cycleId: clock.cycleId,
        slotIndex,
        amount,
      },
    ];
  });
}

export function syncTemporaryAuctionReservations({
  siteKey = DEFAULT_SITE_KEY,
  clock,
  slotStates,
  submittedBids,
  winners,
  winnerBidAmounts,
  winnerAdvertiserAddresses,
}: ReserveFinalizedWinnersParams) {
  if (!Number.isSafeInteger(clock.cycleId)) {
    return;
  }

  const siteIdentity = getSiteIdentity(siteKey);
  const settlementRecords = listBrowserSettlementRecords();
  const candidateReservations = [
    ...createSubmittedBidReservations({
      siteIdentity,
      clock,
      slotStates,
      submittedBids,
    }),
    ...createFinalizedWinnerReservations({
      siteIdentity,
      clock,
      winners,
      winnerBidAmounts,
      winnerAdvertiserAddresses,
    }),
  ].filter(
    (reservation) =>
      isReservationActive(reservation, clock) &&
      !isSettlementBackedReservation(reservation, settlementRecords)
  );
  const candidateKeys = new Set(candidateReservations.map(getReservationKey));
  const currentReservations = getStoredReservations(siteKey);
  const nextReservations = currentReservations.filter(
    (reservation) =>
      candidateKeys.has(getReservationKey(reservation)) &&
      isReservationActive(reservation, clock) &&
      !isSettlementBackedReservation(reservation, settlementRecords)
  );
  const reservationKeys = new Set(nextReservations.map(getReservationKey));

  candidateReservations.forEach((reservation) => {
    const reservationKey = getReservationKey(reservation);

    if (reservationKeys.has(reservationKey)) {
      return;
    }

    reservationKeys.add(reservationKey);
    nextReservations.push(reservation);
  });

  if (
    JSON.stringify(nextReservations) !== JSON.stringify(currentReservations)
  ) {
    setStoredReservations(nextReservations, siteKey);
  }
}

export function getTemporaryReservedAmount(
  advertiserAddress: string | null,
  siteKey: SiteKey = DEFAULT_SITE_KEY
): UsdcMinorUnits {
  if (!advertiserAddress) {
    return 0;
  }

  const normalizedAddress = advertiserAddress.toLowerCase();
  const clock = getAuctionClock(getAuctionStart(siteKey));
  const settlementRecords = listBrowserSettlementRecords();

  return getStoredReservations(siteKey).reduce<UsdcMinorUnits>(
    (total, reservation) =>
      reservation.advertiserAddress.toLowerCase() === normalizedAddress &&
      isReservationActive(reservation, clock) &&
      !isSettlementBackedReservation(reservation, settlementRecords)
        ? addSafeMinorUnits(total, reservation.amount)
        : total,
    0
  );
}

function createSharedEscrowTemporaryReservedAmounts(
  bySite: TemporaryReservedAmountBySite[]
): SharedEscrowTemporaryReservedAmounts {
  return {
    bySite,
    totalReservedAmount: bySite.reduce<UsdcMinorUnits>(
      (total, siteReservedAmount) =>
        addSafeMinorUnits(total, siteReservedAmount.reservedAmount),
      0
    ),
  };
}

export function getSharedEscrowTemporaryReservedAmounts(
  advertiserAddress: string | null
): SharedEscrowTemporaryReservedAmounts {
  return createSharedEscrowTemporaryReservedAmounts(
    SITE_CONFIGS.map((siteConfig) => ({
      siteKey: siteConfig.siteKey,
      reservedAmount: getTemporaryReservedAmount(
        advertiserAddress,
        siteConfig.siteKey
      ),
    }))
  );
}

function subscribeToTemporaryReservations(
  onStoreChange: () => void,
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  if (!isBrowser()) {
    return () => {};
  }

  const reservationStorageKey = getAuctionSiteStorageKey(
    siteKey,
    "temporaryReservations"
  );

  const handleStorageChange = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === reservationStorageKey
    ) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(reservationChangedEventName, onStoreChange);
  const unsubscribeFromSettlementChanges =
    subscribeToSettlementRecordChanges(onStoreChange);
  const interval = window.setInterval(onStoreChange, 500);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(reservationChangedEventName, onStoreChange);
    unsubscribeFromSettlementChanges();
    window.clearInterval(interval);
  };
}

export function useTemporaryReservedAmount(
  advertiserAddress: string | null,
  siteKey: SiteKey = DEFAULT_SITE_KEY
): UsdcMinorUnits {
  return useSyncExternalStore(
    (onStoreChange) =>
      subscribeToTemporaryReservations(onStoreChange, siteKey),
    () => getTemporaryReservedAmount(advertiserAddress, siteKey),
    () => 0
  );
}

export function useSharedEscrowTemporaryReservedAmounts(
  advertiserAddress: string | null
): SharedEscrowTemporaryReservedAmounts {
  const newYorkTimesSquareReservedAmount = useTemporaryReservedAmount(
    advertiserAddress,
    NEW_YORK_TIMES_SQUARE_SITE_KEY
  );
  const losAngelesHollywoodBoulevardReservedAmount = useTemporaryReservedAmount(
    advertiserAddress,
    LOS_ANGELES_HOLLYWOOD_BOULEVARD_SITE_KEY
  );

  return createSharedEscrowTemporaryReservedAmounts([
    {
      siteKey: NEW_YORK_TIMES_SQUARE_SITE_KEY,
      reservedAmount: newYorkTimesSquareReservedAmount,
    },
    {
      siteKey: LOS_ANGELES_HOLLYWOOD_BOULEVARD_SITE_KEY,
      reservedAmount: losAngelesHollywoodBoulevardReservedAmount,
    },
  ]);
}
