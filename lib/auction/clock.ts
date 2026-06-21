import {
  AUCTION_OPEN_SECONDS,
  AUCTION_PLAYBACK_SECONDS_PER_SLOT,
  AUCTION_SELECTING_SECONDS,
  AUCTION_SLOTS,
  AUCTION_TOTAL_CYCLE_SECONDS,
} from "./constants";
import type { AuctionClock } from "./auctionTypes";

export function getAuctionClock(startTimestamp: number): AuctionClock {
  const elapsedTotalSeconds = Math.floor((Date.now() - startTimestamp) / 1000);

  const cycleId = Math.floor(
    elapsedTotalSeconds / AUCTION_TOTAL_CYCLE_SECONDS
  );

  const elapsedInCycle =
    elapsedTotalSeconds % AUCTION_TOTAL_CYCLE_SECONDS;

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
      liveElapsed /
        AUCTION_PLAYBACK_SECONDS_PER_SLOT
    ),
    AUCTION_SLOTS.length - 1
  );

  return {
    phase: "live",
    secondsRemaining:
      AUCTION_PLAYBACK_SECONDS_PER_SLOT -
      (liveElapsed %
        AUCTION_PLAYBACK_SECONDS_PER_SLOT),
    currentSlotIndex,
    cycleId,
    elapsedInCycle,
  };
}