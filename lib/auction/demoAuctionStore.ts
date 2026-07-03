"use client";

import { useCallback, useSyncExternalStore } from "react";

import type {
  Advertisement,
  AuctionClock,
  BidAuthorizationPayload,
  SiteConfig,
  SiteKey,
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
import { AUCTION_SLOTS, BID_AUTHORIZATION_TTL_MS } from "./constants";
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
import { DEFAULT_SITE_KEY, getSiteConfig } from "./siteConfig";

type DemoAuctionSnapshot = {
  isLoaded: boolean;
  siteConfig: SiteConfig;
  siteKey: SiteKey;
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

const listenersBySite = new Map<SiteKey, Set<() => void>>();
const auctionStoreEventName = "pdooh-auction-store-change";

const emptyClock: AuctionClock = {
  phase: "open",
  secondsRemaining: 0,
  currentSlotIndex: 0,
  cycleId: 0,
  elapsedInCycle: 0,
};

const cachedSnapshots = new Map<
  SiteKey,
  { version: number; snapshot: DemoAuctionSnapshot }
>();
const serverSnapshots = new Map<SiteKey, DemoAuctionSnapshot>();
const snapshotVersions = new Map<SiteKey, number>();

function getListeners(siteKey: SiteKey) {
  const listeners = listenersBySite.get(siteKey) ?? new Set<() => void>();

  listenersBySite.set(siteKey, listeners);

  return listeners;
}

function getSnapshotVersion(siteKey: SiteKey) {
  return snapshotVersions.get(siteKey) ?? 0;
}

function createEmptySnapshot(siteKey: SiteKey): DemoAuctionSnapshot {
  const siteConfig = getSiteConfig(siteKey);

  return {
    isLoaded: false,
    siteConfig,
    siteKey: siteConfig.siteKey,
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
}

function emitChange(siteKey: SiteKey = DEFAULT_SITE_KEY) {
  cachedSnapshots.delete(siteKey);
  snapshotVersions.set(siteKey, getSnapshotVersion(siteKey) + 1);
  getListeners(siteKey).forEach((listener) => listener());
}

function notifyAuctionStoreChanged(siteKey: SiteKey = DEFAULT_SITE_KEY) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(auctionStoreEventName, { detail: { siteKey } })
  );
}

function getEventSiteKey(event: Event): SiteKey | null {
  if (!(event instanceof CustomEvent)) {
    return null;
  }

  const detail = event.detail as { siteKey?: unknown } | null;

  return typeof detail?.siteKey === "string"
    ? (detail.siteKey as SiteKey)
    : null;
}

function syncAndEmitChange(siteKey: SiteKey = DEFAULT_SITE_KEY) {
  const clock = getAuctionClock(getAuctionStart(siteKey));

  syncAuctionCycle(clock, siteKey);
  emitChange(siteKey);
}

function subscribeToSite(siteKey: SiteKey, listener: () => void) {
  const listeners = getListeners(siteKey);

  listeners.add(listener);

  if (typeof window === "undefined") {
    return () => {
      listeners.delete(listener);
    };
  }

  const handleStoreChange = () => {
    syncAndEmitChange(siteKey);
  };

  const handleStorageChange = (event: Event) => {
    const eventSiteKey = getEventSiteKey(event);

    if (eventSiteKey && eventSiteKey !== siteKey) {
      return;
    }

    handleStoreChange();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(auctionStoreEventName, handleStorageChange);
  const unsubscribeFromWalletChanges =
    subscribeToWalletChanges(handleStoreChange);

  const interval = window.setInterval(
    () => syncAndEmitChange(siteKey),
    500
  );
  const initialSyncTimeout = window.setTimeout(
    () => syncAndEmitChange(siteKey),
    0
  );

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(auctionStoreEventName, handleStorageChange);
    unsubscribeFromWalletChanges();
    window.clearInterval(interval);
    window.clearTimeout(initialSyncTimeout);
  };
}

function getCurrentWalletAddress() {
  const wallet = getWalletState();

  return wallet.connected ? wallet.address : null;
}

function getSnapshot(siteKey: SiteKey = DEFAULT_SITE_KEY): DemoAuctionSnapshot {
  const currentVersion = getSnapshotVersion(siteKey);
  const cachedSnapshot = cachedSnapshots.get(siteKey);

  if (cachedSnapshot && cachedSnapshot.version === currentVersion) {
    return cachedSnapshot.snapshot;
  }

  const siteConfig = getSiteConfig(siteKey);
  const clock = getAuctionClock(getAuctionStart(siteConfig.siteKey));
  const slotStates = getStoredSlotStates(siteConfig.siteKey);
  const submittedBids = getStoredSubmittedBids(siteConfig.siteKey);
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

  const nextSnapshot: DemoAuctionSnapshot = {
    isLoaded: true,
    siteConfig,
    siteKey: siteConfig.siteKey,
    clock,
    slots: AUCTION_SLOTS,
    advertisements,
    walletBalance: getStoredWalletBalance(),
    demoTreasury: getStoredDemoTreasury(),
    slotStates,
    submittedBids,
    paidSlots: getStoredPaidSlots(siteConfig.siteKey),
    winners,
    winnerBidAmounts,
    winnerAdvertiserAddresses,
    winnerBidAuthorizations,
  };

  cachedSnapshots.set(siteConfig.siteKey, {
    version: currentVersion,
    snapshot: nextSnapshot,
  });

  return nextSnapshot;
}

function getServerSnapshot(
  siteKey: SiteKey = DEFAULT_SITE_KEY
): DemoAuctionSnapshot {
  const cachedServerSnapshot = serverSnapshots.get(siteKey);

  if (cachedServerSnapshot) {
    return cachedServerSnapshot;
  }

  const serverSnapshot = createEmptySnapshot(siteKey);

  serverSnapshots.set(siteKey, serverSnapshot);

  return serverSnapshot;
}

function updateSlot(
  slotIndex: number,
  nextState: Partial<SlotState>,
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  const snapshot = getSnapshot(siteKey);

  updateAuctionSlot(
    slotIndex,
    nextState,
    snapshot.clock.phase,
    snapshot.siteKey
  );
  notifyAuctionStoreChanged(snapshot.siteKey);
  emitChange(snapshot.siteKey);
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
    version: "2",
    marketId: snapshot.siteConfig.marketId,
    siteId: snapshot.siteConfig.siteId,
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
    expiresAt: new Date(Date.now() + BID_AUTHORIZATION_TTL_MS).toISOString(),
  };
}

function isBidPayloadCurrent(
  payload: BidAuthorizationPayload,
  slotIndex: number,
  availableAuctionCapacity: UsdcMinorUnits,
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  const snapshot = getSnapshot(siteKey);
  const slot = snapshot.slotStates[slotIndex];
  const selectedAdvertisement = getSelectedAdvertisement(snapshot, slot);
  const bidAmount = getBidAmount(slot?.bid);

  return (
    snapshot.clock.phase === "open" &&
    payload.marketId === snapshot.siteConfig.marketId &&
    payload.siteId === snapshot.siteConfig.siteId &&
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
  advertiserAddress: `0x${string}`,
  siteKey: SiteKey = DEFAULT_SITE_KEY
): Promise<PlaceBidResult> {
  const snapshot = getSnapshot(siteKey);
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

    if (
      !isBidPayloadCurrent(
        payload,
        slotIndex,
        availableAuctionCapacity,
        snapshot.siteKey
      )
    ) {
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
      bidAuthorization,
      snapshot.siteKey
    );

    if (!isStored) {
      return {
        ok: false,
        error: "Bid could not be submitted. Please check the bid and retry.",
      };
    }

    notifyAuctionStoreChanged(snapshot.siteKey);
    emitChange(snapshot.siteKey);

    return { ok: true };
  } catch (error) {
    return toPlaceBidError(error);
  }
}

export function useDemoAuctionStore(
  siteKey: SiteKey = DEFAULT_SITE_KEY
): DemoAuctionStore {
  const siteConfig = getSiteConfig(siteKey);
  const resolvedSiteKey = siteConfig.siteKey;
  const subscribe = useCallback(
    (listener: () => void) => subscribeToSite(resolvedSiteKey, listener),
    [resolvedSiteKey]
  );
  const getClientSnapshot = useCallback(
    () => getSnapshot(resolvedSiteKey),
    [resolvedSiteKey]
  );
  const getInitialServerSnapshot = useCallback(
    () => getServerSnapshot(resolvedSiteKey),
    [resolvedSiteKey]
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getInitialServerSnapshot
  );

  return {
    ...snapshot,
    updateSlot: (slotIndex, nextState) =>
      updateSlot(slotIndex, nextState, snapshot.siteKey),
    placeBid: (slotIndex, availableAuctionCapacity, advertiserAddress) =>
      placeBid(
        slotIndex,
        availableAuctionCapacity,
        advertiserAddress,
        snapshot.siteKey
      ),
  };
}
