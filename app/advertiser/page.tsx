"use client";

import { useState } from "react";
import AdvertisementsCard from "@/components/advertiser/AdvertisementsCard";
import ConnectWalletCard from "@/components/advertiser/ConnectWalletCard";
import CreateBusinessProfileCard from "@/components/advertiser/CreateBusinessProfileCard";
import DeveloperToolsCard from "@/components/advertiser/DeveloperToolsCard";
import InternalWalletCard from "@/components/advertiser/InternalWalletCard";
import ReadyForAuctionCard from "@/components/advertiser/ReadyForAuctionCard";
import { useDemoAdvertiserStore } from "@/lib/advertiser/demoAdvertiserStore";

export default function AdvertiserPage() {
  const {
    wallet,
    businessName,
    isBusinessProfileCreated,
    balance,
    formattedBalance,
    advertisements,
    setBusinessName,
    createBusinessProfile,
    depositTestUSDC,
  } = useDemoAdvertiserStore();

  const [depositAmount, setDepositAmount] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const canShowBusinessProfile = wallet.connected;
  const canShowWorkspace = wallet.connected && isBusinessProfileCreated;
  const canGoToAuction =
    canShowWorkspace &&
    businessName.trim().length > 0 &&
    advertisements.length > 0 &&
    balance > 0;

  function handleCreateBusinessProfile() {
    const result = createBusinessProfile(businessName);

    if (result.createdDefaultAdvertisement) {
      setSuccessMessage(
        "Demo Advertisement has been created for your business."
      );
    }
  }

  function handleDepositTestUSDC() {
    const isDeposited = depositTestUSDC(depositAmount);

    if (isDeposited) {
      setDepositAmount("");
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
            Connect your wallet, create your business profile, fund your
            internal wallet, manage advertisements, and join the private pDOOH
            auction.
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
          />

          {canShowBusinessProfile && (
            <CreateBusinessProfileCard
              businessName={businessName}
              isBusinessProfileCreated={isBusinessProfileCreated}
              onBusinessNameChange={setBusinessName}
              onCreateBusinessProfile={handleCreateBusinessProfile}
            />
          )}

          {canShowWorkspace && (
            <>
              <InternalWalletCard
                balance={formattedBalance}
                depositAmount={depositAmount}
                onDepositAmountChange={setDepositAmount}
                onDeposit={handleDepositTestUSDC}
              />

              <AdvertisementsCard advertisementCount={advertisements.length} />
            </>
          )}

          {canGoToAuction && (
            <ReadyForAuctionCard
              businessName={businessName}
              advertisementCount={advertisements.length}
              balance={formattedBalance}
            />
          )}

          <DeveloperToolsCard />
        </div>
      </section>
    </main>
  );
}
