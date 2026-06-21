"use client";

import { useSyncExternalStore } from "react";

import type { AuctionClock, SlotState } from "./auctionTypes";
import { getAuctionClock } from "./auctionTimer";
import {
  AUCTION_STORAGE_KEYS,
  AUCTION_SLOTS,
  DEMO_BOT_BID,
} from "./constants";

type DemoAuctionSnapshot = {
  clock: AuctionClock;
  slots: readonly string[];
  slotStates: SlotState[];
  submittedBids: boolean[];
  paidSlots: boolean[];
};

const listeners = new Set<() => void>();

const serverSnapshot: DemoAuctionSnapshot = {
  clock: {
    phase: "open",
    secondsRemaining: 0,
    currentSlotIndex: 0,
    cycleId: 0,
    elapsedInCycle: 0,
  },
  slots: AUCTION_SLOTS,
  slotStates: createEmptySlotStates(),
  submittedBids: createBooleanList(false),
  paidSlots: createBooleanList(false),
};

let cachedSnapshot: DemoAuctionSnapshot | null = null;
let cachedSnapshotSecond = -1;

function emitChange() {
  cachedSnapshot = null;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function createEmptySlotStates(): SlotState[] {
  return AUCTION_SLOTS.map(() => ({
    selectedAdvertisement: "",
    bid: "",
  }));
}

function createBooleanList(value: boolean): boolean[] {
  return AUCTION_SLOTS.map(() => value);
}

function readJson<T>(key: string, fallback: T): T {
  const storage = getBrowserStorage();

  if (!storage) {
    return fallback;
  }

  try {
    const value = storage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  const storage = getBrowserStorage();

  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

function getAuctionStart() {
  const storage = getBrowserStorage();

  if (!storage) {
    return Date.now();
  }

  const storedValue = storage.getItem(AUCTION_STORAGE_KEYS.auctionStart);
  const parsedValue = storedValue ? Number(storedValue) : NaN;

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  const now = Date.now();
  storage.setItem(AUCTION_STORAGE_KEYS.auctionStart, String(now));

  return now;
}

function getSnapshot(): DemoAuctionSnapshot {
  const currentSecond = Math.floor(Date.now() / 1000);

  if (cachedSnapshot && cachedSnapshotSecond === currentSecond) {
    return cachedSnapshot;
  }

  const auctionStart = getAuctionStart();
  const clock = getAuctionClock(auctionStart);

  cachedSnapshot = {
    clock,
    slots: AUCTION_SLOTS,
    slotStates: readJson(
      AUCTION_STORAGE_KEYS.slotStates,
      createEmptySlotStates()
    ),
    submittedBids: readJson(
      AUCTION_STORAGE_KEYS.submittedBids,
      createBooleanList(false)
    ),
    paidSlots: readJson(
      AUCTION_STORAGE_KEYS.paidSlots,
      createBooleanList(false)
    ),
  };

  cachedSnapshotSecond = currentSecond;

  return cachedSnapshot;
}

function getServerSnapshot(): DemoAuctionSnapshot {
  return serverSnapshot;
}

export function useDemoAuctionStore() {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
}

export function updateSlotState(
  slotIndex: number,
  nextState: SlotState
) {
  const slotStates = readJson(
    AUCTION_STORAGE_KEYS.slotStates,
    createEmptySlotStates()
  );

  const nextSlotStates = slotStates.map((slotState, index) => {
    return index === slotIndex ? nextState : slotState;
  });

  writeJson(AUCTION_STORAGE_KEYS.slotStates, nextSlotStates);
  emitChange();
}

export function submitSlotBid(slotIndex: number) {
  const submittedBids = readJson(
    AUCTION_STORAGE_KEYS.submittedBids,
    createBooleanList(false)
  );

  const nextSubmittedBids = submittedBids.map((submitted, index) => {
    return index === slotIndex ? true : submitted;
  });

  writeJson(AUCTION_STORAGE_KEYS.submittedBids, nextSubmittedBids);
  emitChange();
}

export function markSlotPaid(slotIndex: number) {
  const paidSlots = readJson(
    AUCTION_STORAGE_KEYS.paidSlots,
    createBooleanList(false)
  );

  const nextPaidSlots = paidSlots.map((paid, index) => {
    return index === slotIndex ? true : paid;
  });

  writeJson(AUCTION_STORAGE_KEYS.paidSlots, nextPaidSlots);
  emitChange();
}

export function getDemoBotBid() {
  return DEMO_BOT_BID;
}