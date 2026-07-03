import type {
  AuctionClock,
  SiteKey,
  SignedBidAuthorization,
  SlotState,
} from "./auctionTypes";
import {
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";
import {
  AUCTION_OPEN_SECONDS,
  AUCTION_PLAYBACK_SECONDS_PER_SLOT,
  AUCTION_SELECTING_SECONDS,
  AUCTION_SLOTS,
  DEMO_BOT_ADVERTISEMENT,
} from "./constants";
import {
  processAllAuctionSlotPayments,
  processAuctionSlotPayment,
} from "./auctionPayments";
import { getBidExposureWithCandidate } from "./auctionRules";
import { selectAuctionWinners } from "./auctionWinners";
import {
  createBooleanList,
  createEmptySlotStates,
  getStoredAdvertisements,
  getStoredAuctionCycleId,
  getStoredDemoTreasury,
  getStoredPaidSlots,
  getStoredSlotStates,
  getStoredSubmittedBids,
  getStoredWalletBalance,
  setStoredAuctionCycleId,
  setStoredDemoTreasury,
  setStoredPaidSlots,
  setStoredSlotStates,
  setStoredSubmittedBids,
  setStoredWalletBalance,
} from "./auctionStorage";
import { DEFAULT_SITE_KEY } from "./siteConfig";

export function resetAuctionInputs(siteKey: SiteKey = DEFAULT_SITE_KEY) {
  setStoredSlotStates(createEmptySlotStates(), siteKey);
  setStoredSubmittedBids(createBooleanList(false), siteKey);
  setStoredPaidSlots(createBooleanList(false), siteKey);
}

export function updateAuctionSlot(
  slotIndex: number,
  nextState: Partial<SlotState>,
  phase: string,
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  const slotStates = getStoredSlotStates(siteKey);
  const submittedBids = getStoredSubmittedBids(siteKey);

  if (phase !== "open") {
    return;
  }

  if (submittedBids[slotIndex]) {
    return;
  }

  const nextSlotStates = slotStates.map((slotState, index) => {
    return index === slotIndex ? { ...slotState, ...nextState } : slotState;
  });

  setStoredSlotStates(nextSlotStates, siteKey);
}

export function placeAuctionBid(
  slotIndex: number,
  phase: string,
  availableAuctionCapacity: UsdcMinorUnits,
  advertiserAddress: `0x${string}`,
  bidAuthorization: SignedBidAuthorization,
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  const slotStates = getStoredSlotStates(siteKey);
  const submittedBids = getStoredSubmittedBids(siteKey);
  const slot = slotStates[slotIndex];
  const bidAmount = getBidAmount(slot?.bid);

  if (phase !== "open") {
    return false;
  }

  if (submittedBids[slotIndex]) {
    return false;
  }

  if (!slot?.selectedAdvertisement) {
    return false;
  }

  if (!bidAmount || bidAmount <= 0) {
    return false;
  }

  if (
    !Number.isSafeInteger(availableAuctionCapacity) ||
    availableAuctionCapacity <= 0
  ) {
    return false;
  }

  if (
    getBidExposureWithCandidate({
      slotIndex,
      slotStates,
      submittedBids,
    }) > availableAuctionCapacity
  ) {
    return false;
  }

  const nextSubmittedBids = submittedBids.map((isSubmitted, index) => {
    return index === slotIndex ? true : isSubmitted;
  });
  const nextSlotStates = slotStates.map((slotState, index) => {
    return index === slotIndex
      ? { ...slotState, advertiserAddress, bidAuthorization }
      : slotState;
  });

  setStoredSlotStates(nextSlotStates, siteKey);
  setStoredSubmittedBids(nextSubmittedBids, siteKey);

  return true;
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

export function getCurrentAuctionWinners(siteKey: SiteKey = DEFAULT_SITE_KEY) {
  return selectAuctionWinners({
    slotStates: getStoredSlotStates(siteKey),
    submittedBids: getStoredSubmittedBids(siteKey),
    advertisements: getStoredAdvertisements(),
  });
}

export function processAuctionPayment(
  slotIndex: number,
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  const { winners, winnerBidAmounts } = getCurrentAuctionWinners(siteKey);
  // Legacy demo-only payment ledger. It no longer controls auction access or
  // bid validation and remains until the Accounting Layer replaces it.
  const legacyDemoPaymentBalance = getStoredWalletBalance();
  const result = processAuctionSlotPayment({
    slotIndex,
    paidSlots: getStoredPaidSlots(siteKey),
    winners,
    winnerBidAmounts,
    walletBalance: legacyDemoPaymentBalance,
    demoTreasury: getStoredDemoTreasury(),
  });

  setStoredPaidSlots(result.paidSlots, siteKey);
  setStoredWalletBalance(result.walletBalance);
  setStoredDemoTreasury(result.demoTreasury);
}

export function processAllUnpaidAuctionPayments(
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  const { winners, winnerBidAmounts } = getCurrentAuctionWinners(siteKey);
  // Legacy demo-only payment ledger. It is isolated from escrow-backed
  // auction capacity and does not represent on-chain custody.
  const legacyDemoPaymentBalance = getStoredWalletBalance();
  const result = processAllAuctionSlotPayments({
    paidSlots: getStoredPaidSlots(siteKey),
    winners,
    winnerBidAmounts,
    walletBalance: legacyDemoPaymentBalance,
    demoTreasury: getStoredDemoTreasury(),
  });

  setStoredPaidSlots(result.paidSlots, siteKey);
  setStoredWalletBalance(result.walletBalance);
  setStoredDemoTreasury(result.demoTreasury);
}

export function processDueAuctionPayments(
  clock: AuctionClock,
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  if (clock.phase !== "live") {
    return;
  }

  AUCTION_SLOTS.forEach((_, index) => {
    const slotEndTime =
      AUCTION_OPEN_SECONDS +
      AUCTION_SELECTING_SECONDS +
      AUCTION_PLAYBACK_SECONDS_PER_SLOT * (index + 1);

    if (clock.elapsedInCycle >= slotEndTime) {
      processAuctionPayment(index, siteKey);
    }
  });
}

export function syncAuctionCycle(
  clock: AuctionClock,
  siteKey: SiteKey = DEFAULT_SITE_KEY
) {
  const storedCycleId = getStoredAuctionCycleId(siteKey);

  if (storedCycleId === String(clock.cycleId)) {
    processDueAuctionPayments(clock, siteKey);
    return;
  }

  processAllUnpaidAuctionPayments(siteKey);
  setStoredAuctionCycleId(clock.cycleId, siteKey);
  resetAuctionInputs(siteKey);
}

export function createDefaultWinners() {
  return AUCTION_SLOTS.map(() => DEMO_BOT_ADVERTISEMENT);
}
