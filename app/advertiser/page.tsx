"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import ConnectWalletCard from "@/components/advertiser/ConnectWalletCard";
import CreateBusinessProfileCard from "@/components/advertiser/CreateBusinessProfileCard";
import EscrowDepositCard from "@/components/advertiser/EscrowDepositCard";
import LatestSettlementCard from "@/components/advertiser/LatestSettlementCard";
import ReadyForAuctionCard from "@/components/advertiser/ReadyForAuctionCard";
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
import { useDemoAdvertiserStore } from "@/lib/advertiser/demoAdvertiserStore";
import { useSharedEscrowTemporaryReservedAmounts } from "@/lib/auction";
import { useWalletEscrowBalance, useWalletUsdcBalance } from "@/lib/wallet";
import cardStyles from "@/components/ui/OperationalPanel.module.css";
import styles from "./AdvertiserPage.module.css";

const subscribeToHydration = () => () => {};
const getHydratedSnapshot = () => true;
const getServerHydrationSnapshot = () => false;
const CIRCLE_FAUCET_URL = "https://faucet.circle.com";

type BusinessProfileResponse = {
  ok?: boolean;
  profile?: {
    businessName?: unknown;
    isBusinessProfileCreated?: unknown;
  } | null;
};

function getRemoteBusinessName(profile: BusinessProfileResponse["profile"]) {
  if (
    !profile ||
    profile.isBusinessProfileCreated !== true ||
    typeof profile.businessName !== "string"
  ) {
    return null;
  }

  const businessName = profile.businessName.trim();

  return businessName.length > 0 ? businessName : null;
}

async function fetchAccountBusinessProfile(walletAddress: string) {
  const response = await fetch(
    `/api/account/business-profile?walletAddress=${encodeURIComponent(
      walletAddress
    )}`,
    { cache: "no-store" }
  );
  const payload = (await response.json()) as BusinessProfileResponse;

  return response.ok && payload.ok
    ? getRemoteBusinessName(payload.profile)
    : null;
}

async function saveAccountBusinessProfile(
  walletAddress: string,
  businessName: string
) {
  await fetch("/api/account/business-profile", {
    body: JSON.stringify({
      businessName,
      walletAddress,
    }),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
}

export default function AdvertiserPage() {
  const {
    wallet,
    businessName,
    isBusinessProfileCreated,
    advertisements,
    setBusinessName,
    createBusinessProfile,
    updateBusinessProfileName,
    syncBusinessProfileFromRemote,
  } = useDemoAdvertiserStore();

  const walletUsdcBalance = useWalletUsdcBalance();
  const walletEscrowBalance = useWalletEscrowBalance();
  const refreshWalletUsdcBalance = walletUsdcBalance.refresh;
  const refreshWalletEscrowBalance = walletEscrowBalance.refresh;
  const temporaryReservedAmounts =
    useSharedEscrowTemporaryReservedAmounts(wallet.address);
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydrationSnapshot
  );
  const settlementRecordVersion = useSyncExternalStore(
    subscribeToSettlementRecordChanges,
    getSettlementRecordSnapshot,
    getSettlementRecordSnapshot
  );

  useEffect(() => {
    if (!wallet.connected || !wallet.address) {
      return;
    }

    refreshWalletEscrowBalance();
  }, [
    refreshWalletEscrowBalance,
    settlementRecordVersion,
    wallet.address,
    wallet.connected,
  ]);

  useEffect(() => {
    if (!wallet.connected || !wallet.address) {
      return;
    }

    const refreshBalancesAfterReturn = () => {
      refreshWalletUsdcBalance();
      refreshWalletEscrowBalance();
    };
    const refreshBalancesOnVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshBalancesAfterReturn();
      }
    };

    window.addEventListener("focus", refreshBalancesAfterReturn);
    window.addEventListener("pageshow", refreshBalancesAfterReturn);
    document.addEventListener(
      "visibilitychange",
      refreshBalancesOnVisibilityChange
    );

    return () => {
      window.removeEventListener("focus", refreshBalancesAfterReturn);
      window.removeEventListener("pageshow", refreshBalancesAfterReturn);
      document.removeEventListener(
        "visibilitychange",
        refreshBalancesOnVisibilityChange
      );
    };
  }, [
    refreshWalletEscrowBalance,
    refreshWalletUsdcBalance,
    wallet.address,
    wallet.connected,
  ]);

  const settlementRecords = isHydrated ? listBrowserSettlementRecords() : [];
  const unresolvedSettlementReservedAmount =
    getUnresolvedSettlementReservedAmount(
      settlementRecords,
      wallet.address
    );
  const reservedAmount = getTotalReservedAmount({
    siteReservedAmounts: temporaryReservedAmounts.bySite,
    legacyUnresolvedSettlementReservedAmount:
      unresolvedSettlementReservedAmount,
  });

  const availableAuctionCapacity =
    walletEscrowBalance.status === "ready" &&
    walletEscrowBalance.balance !== null
      ? getAvailableFromEscrowBalance(
          walletEscrowBalance.balance,
          reservedAmount
        )
      : 0;

  const [showBusinessNameError, setShowBusinessNameError] = useState(false);
  const [isEditingBusinessName, setIsEditingBusinessName] = useState(false);
  const [editableBusinessName, setEditableBusinessName] = useState("");
  const businessProfileSyncKeyRef = useRef<string | null>(null);

  const isWalletRestoring = wallet.status === "restoring";
  const canShowBusinessProfile = wallet.connected;
  const canShowWorkspace = wallet.connected && isBusinessProfileCreated;

  const hasAvailableAuctionCapacity =
    walletEscrowBalance.status === "ready" &&
    availableAuctionCapacity > 0;

  const canGoToAuction =
    canShowWorkspace &&
    businessName.trim().length > 0 &&
    advertisements.length > 0 &&
    hasAvailableAuctionCapacity;

  useEffect(() => {
    if (!wallet.connected || !wallet.address) {
      businessProfileSyncKeyRef.current = null;
      return;
    }

    const walletAddress = wallet.address;
    const localBusinessName = businessName.trim();
    const syncKey = `${walletAddress.toLowerCase()}:${localBusinessName}:${String(
      isBusinessProfileCreated
    )}`;

    if (businessProfileSyncKeyRef.current === syncKey) {
      return;
    }

    let isActive = true;

    async function syncAccountBusinessProfile() {
      try {
        const remoteBusinessName = await fetchAccountBusinessProfile(
          walletAddress
        );

        if (!isActive) {
          return;
        }

        if (remoteBusinessName) {
          if (
            !isBusinessProfileCreated ||
            remoteBusinessName !== localBusinessName
          ) {
            syncBusinessProfileFromRemote(remoteBusinessName);
          }

          businessProfileSyncKeyRef.current = syncKey;
          return;
        }

        if (isBusinessProfileCreated && localBusinessName) {
          await saveAccountBusinessProfile(walletAddress, localBusinessName);
        }

        businessProfileSyncKeyRef.current = syncKey;
      } catch {
        businessProfileSyncKeyRef.current = null;
      }
    }

    void syncAccountBusinessProfile();

    return () => {
      isActive = false;
    };
  }, [
    businessName,
    isBusinessProfileCreated,
    syncBusinessProfileFromRemote,
    wallet.address,
    wallet.connected,
  ]);

  function handleBusinessNameChange(value: string) {
    setBusinessName(value);

    if (value.trim().length > 0) {
      setShowBusinessNameError(false);
    }
  }

  function handleCreateBusinessProfile() {
    if (businessName.trim().length === 0) {
      setShowBusinessNameError(true);
      return;
    }

    setShowBusinessNameError(false);

    createBusinessProfile(businessName);

    if (wallet.address) {
      void saveAccountBusinessProfile(wallet.address, businessName.trim());
    }
  }

  function handleStartBusinessNameEdit() {
    if (!wallet.connected) {
      return;
    }

    setEditableBusinessName(businessName);
    setShowBusinessNameError(false);
    setIsEditingBusinessName(true);
  }

  function handleEditableBusinessNameChange(value: string) {
    setEditableBusinessName(value);

    if (value.trim().length > 0) {
      setShowBusinessNameError(false);
    }
  }

  function handleSaveBusinessNameEdit() {
    if (!wallet.connected) {
      return;
    }

    if (editableBusinessName.trim().length === 0) {
      setShowBusinessNameError(true);
      return;
    }

    const isUpdated = updateBusinessProfileName(editableBusinessName);

    if (!isUpdated) {
      return;
    }

    setShowBusinessNameError(false);
    setIsEditingBusinessName(false);

    if (wallet.address) {
      void saveAccountBusinessProfile(wallet.address, editableBusinessName.trim());
    }
  }

  function handleCancelBusinessNameEdit() {
    setEditableBusinessName(businessName);
    setShowBusinessNameError(false);
    setIsEditingBusinessName(false);
  }

  function handleEscrowSuccess() {
    refreshWalletUsdcBalance();
    refreshWalletEscrowBalance();
  }

  return (
    <AppBackground className="px-6 py-10">
      <section className="mx-auto max-w-6xl">
        <div
          className={`${styles.landscapeIntroGrid} flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between`}
        >
          <div>
            <h1 className="text-4xl font-bold lg:whitespace-nowrap">
              Advertiser Dashboard
            </h1>

            <p className="mt-3 max-w-2xl text-white/60">
              Log in, fund escrow, create your business profile, manage
              advertisements, and join the pDOOH auction.
            </p>
          </div>

          <div className="w-full lg:w-[483px] lg:shrink-0">
            <LatestSettlementCard
              accountAddress={wallet.address}
              settlementRecords={settlementRecords}
            />
          </div>
        </div>

        <div className={`${styles.landscapeCardGrid} mt-8 grid gap-5`}>
          <ConnectWalletCard
            isWalletConnected={wallet.connected}
            walletStatus={wallet.status}
            usdcBalance={walletUsdcBalance.formattedBalance}
            usdcBalanceStatus={walletUsdcBalance.status}
            usdcBalanceError={walletUsdcBalance.error}
            faucetUrl={CIRCLE_FAUCET_URL}
          />

          {isWalletRestoring && (
            <div className={`${cardStyles.panel} p-6`}>
              <div className="h-5 w-32 rounded-full bg-white/10" />
              <div className="mt-4 h-8 w-64 rounded-full bg-white/10" />
              <div className="mt-5 h-12 rounded-xl bg-white/5" />
            </div>
          )}

          {!isWalletRestoring && canShowBusinessProfile && (
            <>
              <CreateBusinessProfileCard
                businessName={businessName}
                editableBusinessName={editableBusinessName}
                isBusinessProfileCreated={isBusinessProfileCreated}
                isEditingBusinessName={isEditingBusinessName}
                showBusinessNameError={showBusinessNameError}
                isEditDisabled={!wallet.connected}
                onBusinessNameChange={handleBusinessNameChange}
                onEditableBusinessNameChange={handleEditableBusinessNameChange}
                onCreateBusinessProfile={handleCreateBusinessProfile}
                onStartBusinessNameEdit={handleStartBusinessNameEdit}
                onSaveBusinessNameEdit={handleSaveBusinessNameEdit}
                onCancelBusinessNameEdit={handleCancelBusinessNameEdit}
              />

              <EscrowDepositCard
                walletBalanceMinorUnits={walletUsdcBalance.balance}
                walletBalanceStatus={walletUsdcBalance.status}
                walletBalanceError={walletUsdcBalance.error}
                escrowBalance={walletEscrowBalance.formattedBalance}
                escrowBalanceMinorUnits={walletEscrowBalance.balance}
                escrowBalanceStatus={walletEscrowBalance.status}
                escrowBalanceError={walletEscrowBalance.error}
                reservedAmount={reservedAmount}
                onSuccess={handleEscrowSuccess}
              />
            </>
          )}

          {!isWalletRestoring && canGoToAuction && (
            <ReadyForAuctionCard
              businessName={businessName}
              advertisementCount={advertisements.length}
              balance={walletEscrowBalance.formattedBalance}
              balanceStatus={walletEscrowBalance.status}
              balanceError={walletEscrowBalance.error}
            />
          )}
        </div>
      </section>
    </AppBackground>
  );
}
