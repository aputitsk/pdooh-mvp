"use client";

import { useSyncExternalStore } from "react";

import type { Advertisement, AuctionClock, SlotState } from "./auctionTypes";
import type { UsdcMinorUnits } from "@/lib/money/usdc";
import { getAuctionClock } from "./auctionTimer";
import { AUCTION_SLOTS } from "./constants";
import {
  createDefaultWinners,
  placeAuctionBid,
  syncAuctionCycle,
  updateAuctionSlot,
} from "./auctionActions";
import {
  createBooleanList,
  createEmptySlotStates,
  getAuctionStart,
  getStoredAdvertisements,
  getStoredDemoTreasury,
  getStoredPaidSlots,
  getStoredSlotStates,
  getStoredSubmittedBids,
  getStoredWalletBalance,
} from "./auctionStorage";
import { selectAuctionWinners } from "./auctionWinners";

type DemoAuctionSnapshot = {
  isLoaded: boolean;
  clock: AuctionClock;
  slots: readonly string[];
  advertisements: Advertisement[];
  walletBalance: UsdcMinorUnits;
  demoTreasury: UsdcMinorUnits;
  slotStates: SlotState[];
  submittedBids: boolean[];
  paidSlots: boolean[];
  winners: Advertisement[];
  winnerBidAmounts: UsdcMinorUnits[];
};

type DemoAuctionStore = DemoAuctionSnapshot & {
  updateSlot: (slotIndex: number, nextState: Partial<SlotState>) => void;
  placeBid: (
    slotIndex: number,
    availableAuctionCapacity: UsdcMinorUnits
  ) => void;
};

const listeners = new Set<() => void>();
const auctionStoreEventName = "pdooh-auction-store-change";

const emptyClock: AuctionClock = {
  phase: "open",
  secondsRemaining: 0,
  currentSlotIndex: 0,
  cycleId: 0,
  elapsedInCycle: 0,
};

const serverSnapshot: DemoAuctionSnapshot = {
  isLoaded: false,
  clock: emptyClock,
  slots: AUCTION_SLOTS,
  advertisements: [],
  walletBalance: 0,
  demoTreasury: 0,
  slotStates: createEmptySlotStates(),
  submittedBids: createBooleanList(false),
  paidSlots: createBooleanList(false),
  winners: createDefaultWinners(),
  winnerBidAmounts: AUCTION_SLOTS.map(() => 0),
};

let cachedSnapshot: DemoAuctionSnapshot | null = null;
let cachedSnapshotSecond = -1;
let cachedSnapshotVersion = 0;
let snapshotVersion = 0;

function emitChange() {
  cachedSnapshot = null;
  snapshotVersion += 1;
  listeners.forEach((listener) => listener());
}

function notifyAuctionStoreChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(auctionStoreEventName));
}

function syncAndEmitChange() {
  const clock = getAuctionClock(getAuctionStart());

  syncAuctionCycle(clock);
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (typeof window === "undefined") {
    return () => {
      listeners.delete(listener);
    };
  }

  const handleStorageChange = () => {
    syncAndEmitChange();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(auctionStoreEventName, handleStorageChange);

  const interval = window.setInterval(syncAndEmitChange, 500);

  syncAndEmitChange();

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(auctionStoreEventName, handleStorageChange);
    window.clearInterval(interval);
  };
}

function getSnapshot(): DemoAuctionSnapshot {
  const currentSecond = Math.floor(Date.now() / 1000);

  if (
    cachedSnapshot &&
    cachedSnapshotSecond === currentSecond &&
    cachedSnapshotVersion === snapshotVersion
  ) {
    return cachedSnapshot;
  }

  const clock = getAuctionClock(getAuctionStart());
  const slotStates = getStoredSlotStates();
  const submittedBids = getStoredSubmittedBids();
  const advertisements = getStoredAdvertisements();
  const { winners, winnerBidAmounts } = selectAuctionWinners({
    slotStates,
    submittedBids,
    advertisements,
  });

  cachedSnapshot = {
    isLoaded: true,
    clock,
    slots: AUCTION_SLOTS,
    advertisements,
    walletBalance: getStoredWalletBalance(),
    demoTreasury: getStoredDemoTreasury(),
    slotStates,
    submittedBids,
    paidSlots: getStoredPaidSlots(),
    winners,
    winnerBidAmounts,
  };

  cachedSnapshotSecond = currentSecond;
  cachedSnapshotVersion = snapshotVersion;

  return cachedSnapshot;
}

function getServerSnapshot(): DemoAuctionSnapshot {
  return serverSnapshot;
}

function updateSlot(slotIndex: number, nextState: Partial<SlotState>) {
  const snapshot = getSnapshot();

  updateAuctionSlot(slotIndex, nextState, snapshot.clock.phase);
  notifyAuctionStoreChanged();
  emitChange();
}

function placeBid(
  slotIndex: number,
  availableAuctionCapacity: UsdcMinorUnits
) {
  const snapshot = getSnapshot();

  placeAuctionBid(
    slotIndex,
    snapshot.clock.phase,
    availableAuctionCapacity
  );
  notifyAuctionStoreChanged();
  emitChange();
}

export function useDemoAuctionStore(): DemoAuctionStore {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return {
    ...snapshot,
    updateSlot,
    placeBid,
  };
}
