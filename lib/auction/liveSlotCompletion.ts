import {
  AUCTION_OPEN_SECONDS,
  AUCTION_PLAYBACK_SECONDS_PER_SLOT,
  AUCTION_SELECTING_SECONDS,
} from "./constants";
import type { AuctionClock } from "./auctionTypes";

const SETTLEMENT_TRIGGER_SECONDS_INTO_SLOT = 4;

export function getSettlementEligibleLiveSlotIds<T extends string>(
  clock: AuctionClock,
  slotIds: readonly T[]
): T[] {
  if (clock.phase !== "live") {
    return [];
  }

  return slotIds.filter((_, slotIndex) => {
    const slotSettlementTriggerTime =
      AUCTION_OPEN_SECONDS +
      AUCTION_SELECTING_SECONDS +
      AUCTION_PLAYBACK_SECONDS_PER_SLOT * slotIndex +
      SETTLEMENT_TRIGGER_SECONDS_INTO_SLOT;

    return clock.elapsedInCycle >= slotSettlementTriggerTime;
  });
}
