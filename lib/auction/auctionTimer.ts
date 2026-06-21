import type { AuctionClock } from "./auctionTypes";
import {
  AUCTION_OPEN_SECONDS,
  AUCTION_PLAYBACK_SECONDS_PER_SLOT,
  AUCTION_SELECTING_SECONDS,
  AUCTION_SLOTS,
  AUCTION_TOTAL_CYCLE_SECONDS,
} from "./constants";

export function getAuctionClock(startTimestamp: number): AuctionClock {
  const now = Date.now();

  const elapsedTotal = Math.floor((now - startTimestamp) / 1000);

  const elapsedInCycle =
    ((elapsedTotal % AUCTION_TOTAL_CYCLE_SECONDS) +
      AUCTION_TOTAL_CYCLE_SECONDS) %
    AUCTION_TOTAL_CYCLE_SECONDS;

  const cycleId = Math.floor(
    elapsedTotal / AUCTION_TOTAL_CYCLE_SECONDS
  );

  if (elapsedInCycle < AUCTION_OPEN_SECONDS) {
    return {
      phase: "open",
      secondsRemaining: AUCTION_OPEN_SECONDS - elapsedInCycle,
      currentSlotIndex: 0,
      cycleId,
      elapsedInCycle,
    };
  }

  if (
    elapsedInCycle <
    AUCTION_OPEN_SECONDS + AUCTION_SELECTING_SECONDS
  ) {
    return {
      phase: "locked",
      secondsRemaining:
        AUCTION_OPEN_SECONDS +
        AUCTION_SELECTING_SECONDS -
        elapsedInCycle,
      currentSlotIndex: 0,
      cycleId,
      elapsedInCycle,
    };
  }

  const liveElapsed =
    elapsedInCycle -
    AUCTION_OPEN_SECONDS -
    AUCTION_SELECTING_SECONDS;

  const currentSlotIndex = Math.min(
    Math.floor(
      liveElapsed / AUCTION_PLAYBACK_SECONDS_PER_SLOT
    ),
    AUCTION_SLOTS.length - 1
  );

  const secondsRemaining =
    AUCTION_PLAYBACK_SECONDS_PER_SLOT -
    (liveElapsed % AUCTION_PLAYBACK_SECONDS_PER_SLOT);

  return {
    phase: "live",
    secondsRemaining,
    currentSlotIndex,
    cycleId,
    elapsedInCycle,
  };
}