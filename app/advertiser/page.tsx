"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import AdvertisementsCard from "@/components/advertiser/AdvertisementsCard";
import ConnectWalletCard from "@/components/advertiser/ConnectWalletCard";
import CreateBusinessProfileCard from "@/components/advertiser/CreateBusinessProfileCard";
import EscrowDepositCard from "@/components/advertiser/EscrowDepositCard";
import ReadyForAuctionCard from "@/components/advertiser/ReadyForAuctionCard";
import AppBackground from "@/components/layout/AppBackground";
import { getUnresolvedSettlementReservedAmount } from "@/lib/accounting/unresolvedSettlementReservedAmount";
import {
  getSettlementRecordSnapshot,
  listBrowserSettlementRecords,
  subscribeToSettlementRecordChanges,
} from "@/lib/accounting/settlementRecordSync";
import { useDemoAdvertiserStore } from "@/lib/advertiser/demoAdvertiserStore";
import { useTemporaryReservedAmount } from "@/lib/auction";
import { useWalletEscrowBalance, useWalletUsdcBalance } from "@/lib/wallet";

export default function AdvertiserPage() {
  const {
    wallet,
    businessName,
    isBusinessProfileCreated,
    advertisements,
    setBusinessName,
    createBusinessProfile,
    updateBusinessProfileName,
  } = useDemoAdvertiserStore();

  const walletUsdcBalance = useWalletUsdcBalance();
  const walletEscrowBalance = useWalletEscrowBalance();
  const refreshWalletEscrowBalance = walletEscrowBalance.refresh;
  const temporaryReservedAmount = useTemporaryReservedAmount(wallet.address);
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

  const unresolvedSettlementReservedAmount =
    getUnresolvedSettlementReservedAmount(
      listBrowserSettlementRecords(),
      wallet.address
    );
  const reservedAmount = Math.min(
    temporaryReservedAmount + unresolvedSettlementReservedAmount,
    Number.MAX_SAFE_INTEGER
  );

  const availableAuctionCapacity =
    walletEscrowBalance.status === "ready" &&
    walletEscrowBalance.balance !== null
      ? Math.max(walletEscrowBalance.balance - reservedAmount, 0)
      : 0;

  const [showBusinessNameError, setShowBusinessNameError] = useState(false);
  const [isEditingBusinessName, setIsEditingBusinessName] = useState(false);
  const [editableBusinessName, setEditableBusinessName] = useState("");

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
  }

  function handleCancelBusinessNameEdit() {
    setEditableBusinessName(businessName);
    setShowBusinessNameError(false);
    setIsEditingBusinessName(false);
  }

  return (
    <AppBackground className="px-6 py-10">
      <section className="mx-auto max-w-5xl">
        <div>
          <p className="text-sm font-medium text-white/40">
            Advertiser onboarding
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Advertiser Dashboard
          </h1>

          <p className="mt-3 max-w-2xl text-white/60">
            Connect your wallet, fund escrow, create your business profile,
            manage advertisements, and join the pDOOH auction.
          </p>
        </div>

        <div className="mt-8 grid gap-5">
          <ConnectWalletCard
            isWalletConnected={wallet.connected}
            walletAddress={wallet.address}
            walletStatus={wallet.status}
            usdcBalance={walletUsdcBalance.formattedBalance}
            usdcBalanceStatus={walletUsdcBalance.status}
            usdcBalanceError={walletUsdcBalance.error}
          />

          {isWalletRestoring && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
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
                escrowBalance={walletEscrowBalance.formattedBalance}
                escrowBalanceMinorUnits={walletEscrowBalance.balance}
                escrowBalanceStatus={walletEscrowBalance.status}
                escrowBalanceError={walletEscrowBalance.error}
                reservedAmount={reservedAmount}
                onSuccess={() => {
                  walletUsdcBalance.refresh();
                  walletEscrowBalance.refresh();
                }}
              />
            </>
          )}

          {!isWalletRestoring && canShowWorkspace && (
            <AdvertisementsCard advertisementCount={advertisements.length} />
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
