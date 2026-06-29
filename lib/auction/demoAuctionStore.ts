"use client";

import { useSyncExternalStore } from "react";

import type {
  Advertisement,
  AuctionClock,
  BidAuthorizationPayload,
  SignedBidAuthorization,
  SlotState,
} from "./auctionTypes";
import {
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";
import {
  getWalletState,
  signWalletBidAuthorization,
  subscribeToWalletChanges,
} from "@/lib/wallet";
import { ARC_TREASURY_ADDRESS } from "@/lib/arc/arcConfig";
import {
  ARC_CHAIN_ID,
  ARC_USDC_CONTRACT_ADDRESS,
} from "@/lib/arc/arcConstants";
import { getArcEscrowAddress } from "@/lib/arc/arcEscrowConfig";
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
import { getBidExposureWithCandidate } from "./auctionRules";
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
  winnerBidAuthorizations: (SignedBidAuthorization | null)[];
};

type DemoAuctionStore = DemoAuctionSnapshot & {
  updateSlot: (slotIndex: number, nextState: Partial<SlotState>) => void;
  placeBid: (
    slotIndex: number,
    availableAuctionCapacity: UsdcMinorUnits,
    advertiserAddress: `0x${string}`
  ) => Promise<PlaceBidResult>;
};

type PlaceBidResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

const listeners = new Set<() => void>();
const auctionStoreEventName = "pdooh-auction-store-change";
const bidAuthorizationTtlMs = 30 * 60 * 1000;

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
  winnerBidAuthorizations: AUCTION_SLOTS.map(() => null),
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
  const {
    winners,
    winnerBidAmounts,
    winnerAdvertiserAddresses,
    winnerBidAuthorizations,
  } =
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
    winnerBidAuthorizations,
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

function getSlotId(slotIndex: number) {
  return `slot-${slotIndex + 1}`;
}

function getBidAmount(bid: string | undefined) {
  if (!bid) {
    return 0;
  }

  try {
    return parseUSDCToMinorUnits(bid);
  } catch {
    return 0;
  }
}

function getSelectedAdvertisement(
  snapshot: DemoAuctionSnapshot,
  slot: SlotState | undefined
) {
  if (!slot?.selectedAdvertisement) {
    return null;
  }

  return (
    snapshot.advertisements.find(
      (advertisement) => advertisement.name === slot.selectedAdvertisement
    ) ?? null
  );
}

function toPlaceBidError(error: unknown): PlaceBidResult {
  return {
    ok: false,
    error:
      error instanceof Error
        ? error.message
        : "Bid authorization failed. Please retry.",
  };
}

function createBidAuthorizationPayload(params: {
  snapshot: DemoAuctionSnapshot;
  slotIndex: number;
  availableAuctionCapacity: UsdcMinorUnits;
  advertiserAddress: `0x${string}`;
}): BidAuthorizationPayload {
  const {
    snapshot,
    slotIndex,
    availableAuctionCapacity,
    advertiserAddress,
  } = params;
  const slot = snapshot.slotStates[slotIndex];
  const selectedAdvertisement = getSelectedAdvertisement(snapshot, slot);
  const bidAmount = getBidAmount(slot?.bid);

  if (snapshot.clock.phase !== "open") {
    throw new Error("Bidding is closed for this auction cycle.");
  }

  if (snapshot.submittedBids[slotIndex]) {
    throw new Error("This bid has already been submitted.");
  }

  if (!selectedAdvertisement) {
    throw new Error("Select one of your advertisements before placing a bid.");
  }

  if (bidAmount <= 0) {
    throw new Error("Enter a bid greater than zero.");
  }

  if (
    !Number.isSafeInteger(availableAuctionCapacity) ||
    availableAuctionCapacity <= 0
  ) {
    throw new Error("Deposit USDC into escrow before placing bids.");
  }

  if (
    getBidExposureWithCandidate({
      slotIndex,
      slotStates: snapshot.slotStates,
      submittedBids: snapshot.submittedBids,
    }) > availableAuctionCapacity
  ) {
    throw new Error("Total bids exceed available escrow capacity.");
  }

  return {
    purpose: "PDOOH_BID_AUTHORIZATION",
    version: "1",
    advertiserAddress,
    businessName: selectedAdvertisement.businessName,
    advertisementName: selectedAdvertisement.name,
    slotId: getSlotId(slotIndex),
    cycleId: String(snapshot.clock.cycleId),
    bidAmountMinorUnits: String(bidAmount),
    chainId: ARC_CHAIN_ID,
    escrowAddress: getArcEscrowAddress(),
    treasuryAddress: ARC_TREASURY_ADDRESS,
    usdcAddress: ARC_USDC_CONTRACT_ADDRESS,
    expiresAt: new Date(Date.now() + bidAuthorizationTtlMs).toISOString(),
  };
}

function isBidPayloadCurrent(
  payload: BidAuthorizationPayload,
  slotIndex: number,
  availableAuctionCapacity: UsdcMinorUnits
) {
  const snapshot = getSnapshot();
  const slot = snapshot.slotStates[slotIndex];
  const selectedAdvertisement = getSelectedAdvertisement(snapshot, slot);
  const bidAmount = getBidAmount(slot?.bid);

  return (
    snapshot.clock.phase === "open" &&
    !snapshot.submittedBids[slotIndex] &&
    selectedAdvertisement !== null &&
    selectedAdvertisement.name === payload.advertisementName &&
    selectedAdvertisement.businessName === payload.businessName &&
    slot?.selectedAdvertisement === payload.advertisementName &&
    String(snapshot.clock.cycleId) === payload.cycleId &&
    String(bidAmount) === payload.bidAmountMinorUnits &&
    getBidExposureWithCandidate({
      slotIndex,
      slotStates: snapshot.slotStates,
      submittedBids: snapshot.submittedBids,
    }) <= availableAuctionCapacity
  );
}

async function placeBid(
  slotIndex: number,
  availableAuctionCapacity: UsdcMinorUnits,
  advertiserAddress: `0x${string}`
): Promise<PlaceBidResult> {
  const snapshot = getSnapshot();
  let payload: BidAuthorizationPayload;

  try {
    payload = createBidAuthorizationPayload({
      snapshot,
      slotIndex,
      availableAuctionCapacity,
      advertiserAddress,
    });
  } catch (error) {
    return toPlaceBidError(error);
  }

  try {
    const bidAuthorization = await signWalletBidAuthorization(payload);

    if (!isBidPayloadCurrent(payload, slotIndex, availableAuctionCapacity)) {
      return {
        ok: false,
        error: "Bid details changed before authorization completed. Please retry.",
      };
    }

    const isStored = placeAuctionBid(
      slotIndex,
      snapshot.clock.phase,
      availableAuctionCapacity,
      advertiserAddress,
      bidAuthorization
    );

    if (!isStored) {
      return {
        ok: false,
        error: "Bid could not be submitted. Please check the bid and retry.",
      };
    }

    notifyAuctionStoreChanged();
    emitChange();

    return { ok: true };
  } catch (error) {
    return toPlaceBidError(error);
  }
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
