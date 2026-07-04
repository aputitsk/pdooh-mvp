"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import AuctionArea from "@/components/auction/AuctionArea";
import LiveScreen from "@/components/auction/LiveScreen";
import { getMarketTheme } from "@/components/auction/marketTheme";
import SiteSelectorCards from "@/components/auction/SiteSelectorCards";
import AppBackground from "@/components/layout/AppBackground";
import {
  getAvailableFromEscrowBalance,
  getTotalReservedAmount,
} from "@/lib/accounting/reservedAmounts";
import { getUnresolvedSettlementReservedAmount } from "@/lib/accounting/unresolvedSettlementReservedAmount";
import {
  getSettlementRecordSnapshot,
  listBrowserSettlementRecords,
  subscribeToSettlementRecordChanges,
} from "@/lib/accounting/settlementRecordSync";
import type { SettlementRecord } from "@/lib/accounting/settlementRecords";
import { AUCTION_TOTAL_CYCLE_SECONDS } from "@/lib/auction/constants";
import {
  DEFAULT_SITE_KEY,
  type SiteKey,
  useDemoAuctionStore,
  useSharedEscrowTemporaryReservedAmounts,
} from "@/lib/auction";
import {
  useWalletEscrowBalance,
  useWalletStore,
  useWalletUsdcBalance,
} from "@/lib/wallet";

let lastSelectedSiteKey: SiteKey = DEFAULT_SITE_KEY;
const SETTLED_BALANCE_REFRESH_GRACE_MS = 6_000;

function normalizeBidInput(value: string) {
  return value.startsWith(".") ? `0${value}` : value;
}

function getSafeSettlementAmount(record: SettlementRecord) {
  const amount = record.result.amountMinorUnits;

  if (amount <= BigInt(0) || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    return 0;
  }

  return Number(amount);
}

function getPendingEscrowRefreshSettledAmount(
  settlementRecords: readonly SettlementRecord[],
  advertiserAddress: string | null,
  escrowBalanceUpdatedAtMs: number | null,
  nowMs = Date.now()
) {
  if (!advertiserAddress || escrowBalanceUpdatedAtMs === null) {
    return 0;
  }

  const normalizedAdvertiserAddress = advertiserAddress.toLowerCase();

  return settlementRecords.reduce((total, record) => {
    if (
      record.status !== "settled" &&
      record.status !== "already_settled"
    ) {
      return total;
    }

    if (
      record.result.advertiserAddress.toLowerCase() !==
      normalizedAdvertiserAddress
    ) {
      return total;
    }

    const updatedAtMs = Date.parse(record.updatedAt);

    if (
      !Number.isFinite(updatedAtMs) ||
      updatedAtMs <= escrowBalanceUpdatedAtMs ||
      nowMs - updatedAtMs < 0 ||
      nowMs - updatedAtMs > SETTLED_BALANCE_REFRESH_GRACE_MS
    ) {
      return total;
    }

    const next = total + getSafeSettlementAmount(record);
    return Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
  }, 0);
}

export default function ScreenPage() {
  const [selectedSiteKey, setSelectedSiteKey] =
    useState<SiteKey>(lastSelectedSiteKey);
  const auction = useDemoAuctionStore(selectedSiteKey);
  const wallet = useWalletStore();
  const walletUsdcBalance = useWalletUsdcBalance();
  const escrowBalance = useWalletEscrowBalance();
  const temporaryReservedAmounts =
    useSharedEscrowTemporaryReservedAmounts(wallet.address);
  const [bidErrors, setBidErrors] = useState<Record<number, string | null>>({});
  const [authorizingBidSlotIndex, setAuthorizingBidSlotIndex] =
    useState<number | null>(null);
  const handleSiteChange = useCallback((siteKey: SiteKey) => {
    setBidErrors({});
    lastSelectedSiteKey = siteKey;
    setSelectedSiteKey(siteKey);
  }, []);
  const settlementRecordVersion = useSyncExternalStore(
    subscribeToSettlementRecordChanges,
    getSettlementRecordSnapshot,
    getSettlementRecordSnapshot
  );
  const settlementRecords = listBrowserSettlementRecords();
  const unresolvedSettlementReservedAmount =
    getUnresolvedSettlementReservedAmount(settlementRecords, wallet.address);
  const pendingEscrowRefreshSettledAmount =
    getPendingEscrowRefreshSettledAmount(
      settlementRecords,
      wallet.address,
      escrowBalance.updatedAtMs
    );
  const reservedAmount = getTotalReservedAmount({
    siteReservedAmounts: temporaryReservedAmounts.bySite,
    legacyUnresolvedSettlementReservedAmount:
      unresolvedSettlementReservedAmount,
  });
  const displayedReservedAmount = reservedAmount;
  const availableAuctionCapacity =
    escrowBalance.status === "ready" && escrowBalance.balance !== null
      ? getAvailableFromEscrowBalance(
          escrowBalance.balance,
          reservedAmount
        )
      : 0;
  const displayedAvailableAuctionCapacity =
    escrowBalance.status === "ready" && escrowBalance.balance !== null
      ? getAvailableFromEscrowBalance(
          escrowBalance.balance,
          getTotalReservedAmount({
            siteReservedAmounts: temporaryReservedAmounts.bySite,
            legacyUnresolvedSettlementReservedAmount:
              unresolvedSettlementReservedAmount,
            pendingSettledReservedAmount:
              pendingEscrowRefreshSettledAmount,
          })
        )
      : 0;
  const phase = auction.clock.phase;
  const currentSlotIndex = auction.clock.currentSlotIndex;
  const displaySecondsRemaining =
    phase === "live"
      ? Math.max(
          AUCTION_TOTAL_CYCLE_SECONDS - auction.clock.elapsedInCycle,
          0
        )
      : auction.clock.secondsRemaining;
  const submittedBidsKey = auction.submittedBids.join("|");
  const liveWinner =
    phase === "live" ? auction.winners[currentSlotIndex] : null;
  const marketTheme = getMarketTheme(selectedSiteKey);
  const refreshWalletUsdcBalance = walletUsdcBalance.refresh;
  const refreshEscrowBalance = escrowBalance.refresh;
  const clearBidError = useCallback((slotIndex: number) => {
    setBidErrors((currentBidErrors) => ({
      ...currentBidErrors,
      [slotIndex]: null,
    }));
  }, []);

  const handlePlaceBid = useCallback(
    async (slotIndex: number) => {
      if (authorizingBidSlotIndex !== null) {
        return;
      }

      if (!wallet.address) {
        setBidErrors((currentBidErrors) => ({
          ...currentBidErrors,
          [slotIndex]: "Connect your wallet before placing a bid.",
        }));
        return;
      }

      setAuthorizingBidSlotIndex(slotIndex);
      clearBidError(slotIndex);

      try {
        const result = await auction.placeBid(
          slotIndex,
          availableAuctionCapacity,
          wallet.address as `0x${string}`
        );

        if (!result.ok) {
          setBidErrors((currentBidErrors) => ({
            ...currentBidErrors,
            [slotIndex]: result.error,
          }));
        }
      } finally {
        setAuthorizingBidSlotIndex((currentSlotIndex) =>
          currentSlotIndex === slotIndex ? null : currentSlotIndex
        );
      }
    },
    [
      auction,
      authorizingBidSlotIndex,
      availableAuctionCapacity,
      clearBidError,
      wallet.address,
    ]
  );

  useEffect(() => {
    refreshWalletUsdcBalance();
    refreshEscrowBalance();
  }, [
    auction.clock.cycleId,
    auction.clock.phase,
    settlementRecordVersion,
    submittedBidsKey,
    refreshEscrowBalance,
    refreshWalletUsdcBalance,
  ]);

  if (!auction.isLoaded) {
    return (
      <AppBackground className="px-6 py-10">
        <section className="mx-auto max-w-6xl">
          <p className="text-neutral-400">Loading auction...</p>
        </section>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="px-6 py-10">
      <section className="mx-auto max-w-6xl">
        <LiveScreen
          winner={liveWinner}
          marketTheme={marketTheme}
          isLive={phase === "live"}
        />

        <SiteSelectorCards
          selectedSiteKey={selectedSiteKey}
          onSiteChange={handleSiteChange}
          isDisabled={authorizingBidSlotIndex !== null}
        />

        <AuctionArea
          phase={phase}
          secondsRemaining={displaySecondsRemaining}
          slotSecondsRemaining={auction.clock.secondsRemaining}
          currentSlotIndex={currentSlotIndex}
          slots={[...auction.slots]}
          advertisements={auction.advertisements}
          slotStates={auction.slotStates}
          availableAuctionCapacity={availableAuctionCapacity}
          displayedAvailableAuctionCapacity={displayedAvailableAuctionCapacity}
          walletBalance={walletUsdcBalance.formattedBalance}
          walletBalanceStatus={walletUsdcBalance.status}
          walletBalanceError={walletUsdcBalance.error}
          escrowBalance={escrowBalance.balance}
          reservedAmount={displayedReservedAmount}
          escrowBalanceStatus={escrowBalance.status}
          escrowBalanceError={escrowBalance.error}
          submittedBids={auction.submittedBids}
          winners={auction.winners}
          bidErrors={bidErrors}
          authorizingBidSlotIndex={authorizingBidSlotIndex}
          isWalletConnected={wallet.connected}
          isWalletRestoring={wallet.status === "restoring"}
          marketTheme={marketTheme}
          onAdvertisementChange={(slot, value) => {
            clearBidError(slot);
            auction.updateSlot(slot, {
              selectedAdvertisement: value,
            });
          }}
          onBidChange={(slot, value) => {
            clearBidError(slot);
            auction.updateSlot(slot, {
              bid: normalizeBidInput(value),
            });
          }}
          onPlaceBid={handlePlaceBid}
        />
      </section>
    </AppBackground>
  );
}
