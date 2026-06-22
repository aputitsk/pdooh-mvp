"use client";

import { useState, useSyncExternalStore } from "react";
import AdvertisementCard from "@/components/advertisements/AdvertisementCard";
import CreateAdvertisementCard from "@/components/advertisements/CreateAdvertisementCard";
import EmptyAdvertisementsCard from "@/components/advertisements/EmptyAdvertisementsCard";
import {
  addAdvertisement,
  advertisementExists,
  deleteAdvertisement,
  getAdvertisements,
  type Advertisement,
} from "@/lib/advertisements/advertisements";
import { getStoredBusinessName } from "@/lib/advertiser/advertiserStorage";
import {
  isWalletConnected,
  subscribeToWalletChanges,
} from "@/lib/wallet";

function getWalletConnectedSnapshot() {
  return isWalletConnected();
}

function getServerWalletConnectedSnapshot() {
  return false;
}

const emptyAdvertisements: Advertisement[] = [];
const advertisementStoreEventName = "pdooh-advertisements-store-change";

let cachedAdvertisements = emptyAdvertisements;
let cachedAdvertisementsJson = "";

function subscribeToAdvertisementChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(advertisementStoreEventName, onStoreChange);

  const syncInterval = window.setInterval(onStoreChange, 500);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(advertisementStoreEventName, onStoreChange);
    window.clearInterval(syncInterval);
  };
}

function notifyAdvertisementChanges() {
  window.dispatchEvent(new Event(advertisementStoreEventName));
}

function getAdvertisementsSnapshot() {
  const nextAdvertisements = getAdvertisements();
  const nextAdvertisementsJson = JSON.stringify(nextAdvertisements);

  if (nextAdvertisementsJson === cachedAdvertisementsJson) {
    return cachedAdvertisements;
  }

  cachedAdvertisements = nextAdvertisements;
  cachedAdvertisementsJson = nextAdvertisementsJson;
  return cachedAdvertisements;
}

function getServerAdvertisementsSnapshot() {
  return emptyAdvertisements;
}

function getBusinessNameSnapshot() {
  return getStoredBusinessName();
}

function getServerBusinessNameSnapshot() {
  return "";
}

export default function AdvertisementsPage() {
  const walletConnected = useSyncExternalStore(
    subscribeToWalletChanges,
    getWalletConnectedSnapshot,
    getServerWalletConnectedSnapshot
  );
  const businessName = useSyncExternalStore(
    subscribeToAdvertisementChanges,
    getBusinessNameSnapshot,
    getServerBusinessNameSnapshot
  );
  const [adName, setAdName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const advertisements = useSyncExternalStore(
    subscribeToAdvertisementChanges,
    getAdvertisementsSnapshot,
    getServerAdvertisementsSnapshot
  );

  function handleCreateAdvertisement() {
    if (!walletConnected) {
      setErrorMessage("Connect your wallet before creating advertisements.");
      return;
    }

    if (!adName.trim()) {
      setErrorMessage("Enter an advertisement name.");
      return;
    }

    if (!businessName.trim()) {
      setErrorMessage(
        "Create a business profile before adding advertisements."
      );
      return;
    }

    if (advertisementExists(advertisements, adName)) {
      setErrorMessage("Advertisement with this name already exists.");
      return;
    }

    const nextAdvertisements = addAdvertisement(advertisements, {
      name: adName.trim(),
      businessName,
    });

    cachedAdvertisements = nextAdvertisements;
    cachedAdvertisementsJson = JSON.stringify(nextAdvertisements);
    notifyAdvertisementChanges();
    setAdName("");
    setErrorMessage("");
  }

  function handleDeleteAdvertisement(name: string) {
    if (!walletConnected) {
      setErrorMessage("Connect your wallet before deleting advertisements.");
      return;
    }

    const nextAdvertisements = deleteAdvertisement(advertisements, name);
    cachedAdvertisements = nextAdvertisements;
    cachedAdvertisementsJson = JSON.stringify(nextAdvertisements);
    notifyAdvertisementChanges();
  }

  function handleAdNameChange(value: string) {
    setAdName(value);

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  const advertisementCount = advertisements.length;
  const advertisementLabel =
    advertisementCount === 1 ? "Advertisement" : "Advertisements";

  return (
    <main className="min-h-screen bg-[#05060A] px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-white/40">
              Advertisement workspace
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              Advertisements
            </h1>

            <p className="mt-3 max-w-2xl text-white/60">
              Create, manage, and delete advertisements used in private auction
              slots.
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/70">
            {advertisementCount} {advertisementLabel}
          </div>
        </div>

        {!walletConnected && (
          <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm font-medium text-yellow-300">
            Connect your wallet to create or delete advertisements.
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
          <CreateAdvertisementCard
            adName={adName}
            errorMessage={errorMessage}
            onAdNameChange={handleAdNameChange}
            onCreateAdvertisement={handleCreateAdvertisement}
          />

          <div>
            {advertisements.length === 0 ? (
              <EmptyAdvertisementsCard />
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {advertisements.map((advertisement) => (
                  <AdvertisementCard
                    key={`${advertisement.businessName}-${advertisement.name}`}
                    advertisement={advertisement}
                    onDelete={handleDeleteAdvertisement}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
