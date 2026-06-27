"use client";

import { useState } from "react";
import AdvertisementsCard from "@/components/advertiser/AdvertisementsCard";
import ConnectWalletCard from "@/components/advertiser/ConnectWalletCard";
import CreateBusinessProfileCard from "@/components/advertiser/CreateBusinessProfileCard";
import EscrowDepositCard from "@/components/advertiser/EscrowDepositCard";
import ReadyForAuctionCard from "@/components/advertiser/ReadyForAuctionCard";
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
  } = useDemoAdvertiserStore();

  const walletUsdcBalance = useWalletUsdcBalance();
  const walletEscrowBalance = useWalletEscrowBalance();
  const reservedAmount = useTemporaryReservedAmount(wallet.address);

  const availableAuctionCapacity =
    walletEscrowBalance.status === "ready" &&
    walletEscrowBalance.balance !== null
      ? Math.max(walletEscrowBalance.balance - reservedAmount, 0)
      : 0;

  const [successMessage, setSuccessMessage] = useState("");

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

  function handleCreateBusinessProfile() {
    const result = createBusinessProfile(businessName);

    if (result.createdDefaultAdvertisement) {
      setSuccessMessage(
        "Demo Advertisement has been created for your business."
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#05060A] px-6 py-10 text-white">
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
            manage advertisements, and join the private pDOOH auction.
          </p>
        </div>

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-300">
            ✅ {successMessage}
          </div>
        )}

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
                isBusinessProfileCreated={isBusinessProfileCreated}
                onBusinessNameChange={setBusinessName}
                onCreateBusinessProfile={handleCreateBusinessProfile}
              />

              <EscrowDepositCard
                escrowBalance={walletEscrowBalance.formattedBalance}
                escrowBalanceStatus={walletEscrowBalance.status}
                escrowBalanceError={walletEscrowBalance.error}
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
    </main>
  );
}