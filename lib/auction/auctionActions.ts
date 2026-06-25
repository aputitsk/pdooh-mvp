import type { AuctionClock, SlotState } from "./auctionTypes";
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

export function resetAuctionInputs() {
  setStoredSlotStates(createEmptySlotStates());
  setStoredSubmittedBids(createBooleanList(false));
  setStoredPaidSlots(createBooleanList(false));
}

export function updateAuctionSlot(
  slotIndex: number,
  nextState: Partial<SlotState>,
  phase: string
) {
  const slotStates = getStoredSlotStates();
  const submittedBids = getStoredSubmittedBids();

  if (phase !== "open") {
    return;
  }

  if (submittedBids[slotIndex]) {
    return;
  }

  const nextSlotStates = slotStates.map((slotState, index) => {
    return index === slotIndex ? { ...slotState, ...nextState } : slotState;
  });

  setStoredSlotStates(nextSlotStates);
}

export function placeAuctionBid(
  slotIndex: number,
  phase: string,
  availableAuctionCapacity: UsdcMinorUnits,
  advertiserAddress: `0x${string}`
) {
  const slotStates = getStoredSlotStates();
  const submittedBids = getStoredSubmittedBids();
  const slot = slotStates[slotIndex];
  const bidAmount = getBidAmount(slot?.bid);

  if (phase !== "open") {
    return;
  }

  if (submittedBids[slotIndex]) {
    return;
  }

  if (!slot?.selectedAdvertisement) {
    return;
  }

  if (!bidAmount || bidAmount <= 0) {
    return;
  }

  if (
    !Number.isSafeInteger(availableAuctionCapacity) ||
    availableAuctionCapacity <= 0
  ) {
    return;
  }

  if (
    getBidExposureWithCandidate({
      slotIndex,
      slotStates,
      submittedBids,
    }) > availableAuctionCapacity
  ) {
    return;
  }

  const nextSubmittedBids = submittedBids.map((isSubmitted, index) => {
    return index === slotIndex ? true : isSubmitted;
  });
  const nextSlotStates = slotStates.map((slotState, index) => {
    return index === slotIndex
      ? { ...slotState, advertiserAddress }
      : slotState;
  });

  setStoredSlotStates(nextSlotStates);
  setStoredSubmittedBids(nextSubmittedBids);
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

export function getCurrentAuctionWinners() {
  return selectAuctionWinners({
    slotStates: getStoredSlotStates(),
    submittedBids: getStoredSubmittedBids(),
    advertisements: getStoredAdvertisements(),
  });
}

export function processAuctionPayment(slotIndex: number) {
  const { winners, winnerBidAmounts } = getCurrentAuctionWinners();
  // Legacy demo-only payment ledger. It no longer controls auction access or
  // bid validation and remains until the Accounting Layer replaces it.
  const legacyDemoPaymentBalance = getStoredWalletBalance();
  const result = processAuctionSlotPayment({
    slotIndex,
    paidSlots: getStoredPaidSlots(),
    winners,
    winnerBidAmounts,
    walletBalance: legacyDemoPaymentBalance,
    demoTreasury: getStoredDemoTreasury(),
  });

  setStoredPaidSlots(result.paidSlots);
  setStoredWalletBalance(result.walletBalance);
  setStoredDemoTreasury(result.demoTreasury);
}

export function processAllUnpaidAuctionPayments() {
  const { winners, winnerBidAmounts } = getCurrentAuctionWinners();
  // Legacy demo-only payment ledger. It is isolated from escrow-backed
  // auction capacity and does not represent on-chain custody.
  const legacyDemoPaymentBalance = getStoredWalletBalance();
  const result = processAllAuctionSlotPayments({
    paidSlots: getStoredPaidSlots(),
    winners,
    winnerBidAmounts,
    walletBalance: legacyDemoPaymentBalance,
    demoTreasury: getStoredDemoTreasury(),
  });

  setStoredPaidSlots(result.paidSlots);
  setStoredWalletBalance(result.walletBalance);
  setStoredDemoTreasury(result.demoTreasury);
}

export function processDueAuctionPayments(clock: AuctionClock) {
  if (clock.phase !== "live") {
    return;
  }

  AUCTION_SLOTS.forEach((_, index) => {
    const slotEndTime =
      AUCTION_OPEN_SECONDS +
      AUCTION_SELECTING_SECONDS +
      AUCTION_PLAYBACK_SECONDS_PER_SLOT * (index + 1);

    if (clock.elapsedInCycle >= slotEndTime) {
      processAuctionPayment(index);
    }
  });
}

export function syncAuctionCycle(clock: AuctionClock) {
  const storedCycleId = getStoredAuctionCycleId();

  if (storedCycleId === String(clock.cycleId)) {
    processDueAuctionPayments(clock);
    return;
  }

  processAllUnpaidAuctionPayments();
  setStoredAuctionCycleId(clock.cycleId);
  resetAuctionInputs();
}

export function createDefaultWinners() {
  return AUCTION_SLOTS.map(() => DEMO_BOT_ADVERTISEMENT);
}
