"use client";

import { useState } from "react";
import AdvertisementsCard from "@/components/advertiser/AdvertisementsCard";
import ConnectWalletCard from "@/components/advertiser/ConnectWalletCard";
import CreateCompanyCard from "@/components/advertiser/CreateCompanyCard";
import DeveloperToolsCard from "@/components/advertiser/DeveloperToolsCard";
import InternalWalletCard from "@/components/advertiser/InternalWalletCard";
import ReadyForAuctionCard from "@/components/advertiser/ReadyForAuctionCard";
import { useDemoAdvertiserStore } from "@/lib/advertiser/demoAdvertiserStore";

export default function AdvertiserPage() {
  const {
    wallet,
    companyName,
    isCompanyCreated,
    balance,
    advertisements,
    setCompanyName,
    createCompany,
    depositTestUSDC,
  } = useDemoAdvertiserStore();

  const [depositAmount, setDepositAmount] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const canShowCompany = wallet.connected;
  const canShowWorkspace = wallet.connected && isCompanyCreated;
  const canGoToAuction =
    canShowWorkspace &&
    companyName.trim().length > 0 &&
    advertisements.length > 0 &&
    Number(balance) > 0;

  function handleCreateCompany() {
    const result = createCompany(companyName);

    if (result.createdDefaultAdvertisement) {
      setSuccessMessage(
        "Demo Advertisement has been created for your company."
      );
    }
  }

  function handleDepositTestUSDC() {
    const isDeposited = depositTestUSDC(depositAmount, balance);

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

          <h1 className="mt-2 text-4xl font-bold">Company Dashboard</h1>

          <p className="mt-3 max-w-2xl text-white/60">
            Connect your wallet, create a company, fund your internal wallet,
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
          />

          {canShowCompany && (
            <CreateCompanyCard
              companyName={companyName}
              isCompanyCreated={isCompanyCreated}
              onCompanyNameChange={setCompanyName}
              onCreateCompany={handleCreateCompany}
            />
          )}

          {canShowWorkspace && (
            <>
              <InternalWalletCard
                balance={balance}
                depositAmount={depositAmount}
                onDepositAmountChange={setDepositAmount}
                onDeposit={handleDepositTestUSDC}
              />

              <AdvertisementsCard advertisementCount={advertisements.length} />
            </>
          )}

          {canGoToAuction && (
            <ReadyForAuctionCard
              companyName={companyName}
              advertisementCount={advertisements.length}
              balance={Number(balance)}
            />
          )}

          <DeveloperToolsCard />
        </div>
      </section>
    </main>
  );
}