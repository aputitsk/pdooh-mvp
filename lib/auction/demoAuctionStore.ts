"use client";

import { useSyncExternalStore } from "react";

import type { Advertisement, AuctionClock, SlotState } from "./auctionTypes";
import type { UsdcMinorUnits } from "@/lib/money/usdc";
import { getWalletState, subscribeToWalletChanges } from "@/lib/wallet";
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
  winnerAdvertiserAddresses: (`0x${string}` | null)[];
};

type DemoAuctionStore = DemoAuctionSnapshot & {
  updateSlot: (slotIndex: number, nextState: Partial<SlotState>) => void;
  placeBid: (
    slotIndex: number,
    availableAuctionCapacity: UsdcMinorUnits,
    advertiserAddress: `0x${string}`
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
  winnerAdvertiserAddresses: AUCTION_SLOTS.map(() => null),
};

let cachedSnapshot: DemoAuctionSnapshot | null = null;
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
  const unsubscribeFromWalletChanges =
    subscribeToWalletChanges(handleStorageChange);

  const interval = window.setInterval(syncAndEmitChange, 500);

  syncAndEmitChange();

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(auctionStoreEventName, handleStorageChange);
    unsubscribeFromWalletChanges();
    window.clearInterval(interval);
  };
}

function getCurrentWalletAddress() {
  const wallet = getWalletState();

  return wallet.connected ? wallet.address : null;
}

function getSnapshot(): DemoAuctionSnapshot {
  if (
    cachedSnapshot &&
    cachedSnapshotVersion === snapshotVersion
  ) {
    return cachedSnapshot;
  }

  const clock = getAuctionClock(getAuctionStart());
  const slotStates = getStoredSlotStates();
  const submittedBids = getStoredSubmittedBids();
  const advertisements = getStoredAdvertisements(getCurrentWalletAddress());
  const { winners, winnerBidAmounts, winnerAdvertiserAddresses } =
    selectAuctionWinners({
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
    winnerAdvertiserAddresses,
  };

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
  availableAuctionCapacity: UsdcMinorUnits,
  advertiserAddress: `0x${string}`
) {
  const snapshot = getSnapshot();
  const slot = snapshot.slotStates[slotIndex];
  const hasWalletAdvertisement = snapshot.advertisements.some(
    (advertisement) => advertisement.name === slot?.selectedAdvertisement
  );

  if (!hasWalletAdvertisement) {
    return;
  }

  placeAuctionBid(
    slotIndex,
    snapshot.clock.phase,
    availableAuctionCapacity,
    advertiserAddress
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
