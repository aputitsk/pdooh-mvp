"use client";

import { useSyncExternalStore } from "react";

import {
  AUCTION_OPEN_SECONDS,
  AUCTION_PLAYBACK_SECONDS_PER_SLOT,
  AUCTION_SELECTING_SECONDS,
  AUCTION_STORAGE_KEYS,
  DEMO_BOT_ADVERTISEMENT,
} from "./constants";
import { getAuctionStart } from "./auctionStorage";
import { getAuctionClock } from "./auctionTimer";
import type { Advertisement, AuctionClock } from "./auctionTypes";
import type { UsdcMinorUnits } from "@/lib/money/usdc";

type TemporaryAuctionReservation = {
  advertiserAddress: string;
  cycleId: number;
  slotIndex: number;
  amount: UsdcMinorUnits;
};

type ReserveFinalizedWinnersParams = {
  advertiserAddress: string;
  clock: AuctionClock;
  winners: Advertisement[];
  winnerBidAmounts: UsdcMinorUnits[];
};

const reservationChangedEventName =
  "pdooh-temporary-auction-reservations-change";

function isBrowser() {
  return typeof window !== "undefined";
}

function getStoredReservations(): TemporaryAuctionReservation[] {
  if (!isBrowser()) {
    return [];
  }

  const stored = window.localStorage.getItem(
    AUCTION_STORAGE_KEYS.temporaryReservations
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

function setStoredReservations(reservations: TemporaryAuctionReservation[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    AUCTION_STORAGE_KEYS.temporaryReservations,
    JSON.stringify(reservations)
  );
  window.dispatchEvent(new Event(reservationChangedEventName));
}

function getReservationKey(reservation: TemporaryAuctionReservation) {
  return [
    reservation.advertiserAddress.toLowerCase(),
    reservation.cycleId,
    reservation.slotIndex,
  ].join(":");
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

export function syncTemporaryAuctionReservations({
  advertiserAddress,
  clock,
  winners,
  winnerBidAmounts,
}: ReserveFinalizedWinnersParams) {
  if (!advertiserAddress || !Number.isSafeInteger(clock.cycleId)) {
    return;
  }

  const currentReservations = getStoredReservations();
  const nextReservations = currentReservations.filter((reservation) =>
    isReservationActive(reservation, clock)
  );
  const reservationKeys = new Set(nextReservations.map(getReservationKey));

  if (clock.phase === "locked" || clock.phase === "live") {
    winners.forEach((winner, slotIndex) => {
      const amount = winnerBidAmounts[slotIndex] ?? 0;

      if (
        winner.businessName === DEMO_BOT_ADVERTISEMENT.businessName ||
        !Number.isSafeInteger(amount) ||
        amount <= 0
      ) {
        return;
      }

      const reservation: TemporaryAuctionReservation = {
        advertiserAddress,
        cycleId: clock.cycleId,
        slotIndex,
        amount,
      };

      if (!isReservationActive(reservation, clock)) {
        return;
      }

      const reservationKey = getReservationKey(reservation);

      if (reservationKeys.has(reservationKey)) {
        return;
      }

      reservationKeys.add(reservationKey);
      nextReservations.push(reservation);
    });
  }

  if (
    JSON.stringify(nextReservations) !== JSON.stringify(currentReservations)
  ) {
    setStoredReservations(nextReservations);
  }
}

export function getTemporaryReservedAmount(
  advertiserAddress: string | null
): UsdcMinorUnits {
  if (!advertiserAddress) {
    return 0;
  }

  const normalizedAddress = advertiserAddress.toLowerCase();
  const clock = getAuctionClock(getAuctionStart());

  return getStoredReservations().reduce<UsdcMinorUnits>(
    (total, reservation) =>
      reservation.advertiserAddress.toLowerCase() === normalizedAddress &&
      isReservationActive(reservation, clock)
        ? addSafeMinorUnits(total, reservation.amount)
        : total,
    0
  );
}

function subscribeToTemporaryReservations(onStoreChange: () => void) {
  if (!isBrowser()) {
    return () => {};
  }

  const handleStorageChange = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === AUCTION_STORAGE_KEYS.temporaryReservations
    ) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(reservationChangedEventName, onStoreChange);
  const interval = window.setInterval(onStoreChange, 500);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(reservationChangedEventName, onStoreChange);
    window.clearInterval(interval);
  };
}

export function useTemporaryReservedAmount(
  advertiserAddress: string | null
): UsdcMinorUnits {
  return useSyncExternalStore(
    subscribeToTemporaryReservations,
    () => getTemporaryReservedAmount(advertiserAddress),
    () => 0
  );
}
