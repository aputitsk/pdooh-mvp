"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import AuctionArea from "@/components/auction/AuctionArea";
import LiveScreen from "@/components/auction/LiveScreen";
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
import { AUCTION_TOTAL_CYCLE_SECONDS } from "@/lib/auction/constants";
import {
  DEFAULT_SITE_KEY,
  MARKET_CONFIGS,
  SITE_CONFIGS,
  type SiteConfig,
  type SiteKey,
  useDemoAuctionStore,
  useSharedEscrowTemporaryReservedAmounts,
} from "@/lib/auction";
import {
  useWalletEscrowBalance,
  useWalletStore,
  useWalletUsdcBalance,
} from "@/lib/wallet";

function getMarketName(siteConfig: SiteConfig) {
  return (
    MARKET_CONFIGS.find((market) => market.id === siteConfig.marketId)?.name ??
    siteConfig.marketId
  );
}

function getSiteLabel(siteConfig: SiteConfig) {
  return `${getMarketName(siteConfig)} / ${siteConfig.name}`;
}

function SiteSelector({
  selectedSiteKey,
  selectedSiteConfig,
  cycleId,
  phase,
  onSiteChange,
  isDisabled,
}: {
  selectedSiteKey: SiteKey;
  selectedSiteConfig: SiteConfig;
  cycleId: number | string;
  phase: string;
  onSiteChange: (siteKey: SiteKey) => void;
  isDisabled: boolean;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
          Market / Site
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-white">
          {getSiteLabel(selectedSiteConfig)}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-white/60">
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
            Cycle {cycleId}
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 capitalize">
            {phase}
          </span>
        </div>

        <select
          value={selectedSiteKey}
          onChange={(event) => onSiteChange(event.target.value as SiteKey)}
          disabled={isDisabled}
          className="h-10 rounded-xl border border-white/10 bg-black px-3 text-sm font-semibold text-white outline-none transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {SITE_CONFIGS.map((siteConfig) => (
            <option key={siteConfig.siteKey} value={siteConfig.siteKey}>
              {getSiteLabel(siteConfig)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function ScreenPage() {
  const [selectedSiteKey, setSelectedSiteKey] =
    useState<SiteKey>(DEFAULT_SITE_KEY);
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
          displayedReservedAmount
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
  const selectedSiteLabel = getSiteLabel(auction.siteConfig);
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
        <SiteSelector
          selectedSiteKey={auction.siteKey}
          selectedSiteConfig={auction.siteConfig}
          cycleId={auction.clock.cycleId}
          phase={phase}
          onSiteChange={handleSiteChange}
          isDisabled={authorizingBidSlotIndex !== null}
        />

        <LiveScreen
          winner={liveWinner}
          siteLabel={selectedSiteLabel}
          cycleId={auction.clock.cycleId}
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
          displayedAvailableAuctionCapacity={availableAuctionCapacity}
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
          onAdvertisementChange={(slot, value) => {
            clearBidError(slot);
            auction.updateSlot(slot, {
              selectedAdvertisement: value,
            });
          }}
          onBidChange={(slot, value) => {
            clearBidError(slot);
            auction.updateSlot(slot, {
              bid: value,
            });
          }}
          onPlaceBid={handlePlaceBid}
        />
      </section>
    </AppBackground>
  );
}
