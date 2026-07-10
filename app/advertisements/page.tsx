"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import AdvertisementCard from "@/components/advertisements/AdvertisementCard";
import CreateAdvertisementCard from "@/components/advertisements/CreateAdvertisementCard";
import EmptyAdvertisementsCard from "@/components/advertisements/EmptyAdvertisementsCard";
import AppBackground from "@/components/layout/AppBackground";
import {
  ADVERTISEMENT_NAME_MAX_LENGTH,
  addAdvertisement,
  advertisementExists,
  advertisementExistsExcept,
  deleteAdvertisement,
  getAdvertisements,
  updateAdvertisementName,
  type Advertisement,
} from "@/lib/advertisements/advertisements";
import { getStoredBusinessName } from "@/lib/advertiser/advertiserStorage";
import {
  getWalletState,
  subscribeToWalletChanges,
  useWalletStore,
} from "@/lib/wallet";

const emptyAdvertisements: Advertisement[] = [];
const advertisementStoreEventName = "pdooh-advertisements-store-change";
const ADVERTISEMENTS_PAGE_SIZE = 6;
const paginationButtonClassName =
  "rounded-full border border-[#4F8CFF]/35 bg-[#10284D]/45 px-4 py-2 font-semibold text-[#E7F0FF] shadow-[0_0_10px_#4F8CFF18] transition hover:border-[#5A8DFF]/55 hover:bg-[#183B6A]/55 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-white/30 disabled:shadow-none";

let cachedAdvertisements = emptyAdvertisements;
let cachedAdvertisementsJson = "";

function subscribeToAdvertisementChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(advertisementStoreEventName, onStoreChange);
  const unsubscribeFromWalletChanges = subscribeToWalletChanges(onStoreChange);

  const syncInterval = window.setInterval(onStoreChange, 500);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(advertisementStoreEventName, onStoreChange);
    unsubscribeFromWalletChanges();
    window.clearInterval(syncInterval);
  };
}

function notifyAdvertisementChanges() {
  window.dispatchEvent(new Event(advertisementStoreEventName));
}

function getAdvertisementsSnapshot() {
  const wallet = getWalletState();
  const nextAdvertisements = getAdvertisements(
    wallet.connected ? wallet.address : null
  );
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
  const wallet = getWalletState();

  return getStoredBusinessName(wallet.connected ? wallet.address : null);
}

function getServerBusinessNameSnapshot() {
  return "";
}

export default function AdvertisementsPage() {
  const wallet = useWalletStore();
  const walletConnected = wallet.connected && Boolean(wallet.address);
  const isWalletRestoring = wallet.status === "restoring";
  const businessName = useSyncExternalStore(
    subscribeToAdvertisementChanges,
    getBusinessNameSnapshot,
    getServerBusinessNameSnapshot
  );
  const [adName, setAdName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isCreateSuccessVisible, setIsCreateSuccessVisible] =
    useState(false);
  const [editingAdvertisementName, setEditingAdvertisementName] =
    useState("");
  const [editableAdvertisementName, setEditableAdvertisementName] =
    useState("");
  const [editErrorMessage, setEditErrorMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const advertisements = useSyncExternalStore(
    subscribeToAdvertisementChanges,
    getAdvertisementsSnapshot,
    getServerAdvertisementsSnapshot
  );
  const totalPages = Math.max(
    1,
    Math.ceil(advertisements.length / ADVERTISEMENTS_PAGE_SIZE)
  );
  const visiblePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (visiblePage - 1) * ADVERTISEMENTS_PAGE_SIZE;
  const paginatedAdvertisements = advertisements.slice(
    pageStartIndex,
    pageStartIndex + ADVERTISEMENTS_PAGE_SIZE
  );
  const shouldShowPagination = advertisements.length > ADVERTISEMENTS_PAGE_SIZE;

  useEffect(() => {
    if (!isCreateSuccessVisible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsCreateSuccessVisible(false);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isCreateSuccessVisible]);

  function handleCreateAdvertisement() {
    if (isWalletRestoring) {
      return;
    }

    if (!walletConnected) {
      setErrorMessage("Connect your wallet before creating advertisements.");
      return;
    }

    if (!adName.trim()) {
      setErrorMessage("Enter an advertisement name.");
      return;
    }

    if (adName.trim().length > ADVERTISEMENT_NAME_MAX_LENGTH) {
      setErrorMessage(
        `Advertisement name must be ${ADVERTISEMENT_NAME_MAX_LENGTH} characters or fewer.`
      );
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

    const nextAdvertisements = addAdvertisement(
      advertisements,
      {
        name: adName.trim(),
        businessName,
      },
      wallet.address
    );

    cachedAdvertisements = nextAdvertisements;
    cachedAdvertisementsJson = JSON.stringify(nextAdvertisements);
    notifyAdvertisementChanges();
    setAdName("");
    setErrorMessage("");
    setIsCreateSuccessVisible(true);
  }

  function handleDeleteAdvertisement(name: string) {
    if (isWalletRestoring) {
      return;
    }

    if (!walletConnected) {
      setErrorMessage("Connect your wallet before deleting advertisements.");
      return;
    }

    const nextAdvertisements = deleteAdvertisement(
      advertisements,
      name,
      wallet.address
    );
    cachedAdvertisements = nextAdvertisements;
    cachedAdvertisementsJson = JSON.stringify(nextAdvertisements);
    notifyAdvertisementChanges();
  }

  function handleStartAdvertisementEdit(name: string) {
    if (isWalletRestoring) {
      return;
    }

    if (!walletConnected) {
      setErrorMessage("Connect your wallet before editing advertisements.");
      return;
    }

    setEditingAdvertisementName(name);
    setEditableAdvertisementName(name);
    setEditErrorMessage("");
    setErrorMessage("");
  }

  function handleEditableAdvertisementNameChange(value: string) {
    setEditableAdvertisementName(value);

    if (editErrorMessage) {
      setEditErrorMessage("");
    }
  }

  function handleSaveAdvertisementEdit(currentName: string) {
    if (isWalletRestoring) {
      return;
    }

    if (!walletConnected) {
      setErrorMessage("Connect your wallet before editing advertisements.");
      return;
    }

    const nextName = editableAdvertisementName.trim();

    if (!nextName) {
      setEditErrorMessage("Advertisement name is required.");
      return;
    }

    if (nextName.length > ADVERTISEMENT_NAME_MAX_LENGTH) {
      setEditErrorMessage(
        `Advertisement name must be ${ADVERTISEMENT_NAME_MAX_LENGTH} characters or fewer.`
      );
      return;
    }

    if (advertisementExistsExcept(advertisements, nextName, currentName)) {
      setEditErrorMessage("Advertisement with this name already exists.");
      return;
    }

    const nextAdvertisements = updateAdvertisementName(
      advertisements,
      currentName,
      nextName,
      wallet.address
    );

    cachedAdvertisements = nextAdvertisements;
    cachedAdvertisementsJson = JSON.stringify(nextAdvertisements);
    notifyAdvertisementChanges();
    setEditingAdvertisementName("");
    setEditableAdvertisementName("");
    setEditErrorMessage("");
  }

  function handleCancelAdvertisementEdit() {
    setEditingAdvertisementName("");
    setEditableAdvertisementName("");
    setEditErrorMessage("");
  }

  function handleAdNameChange(value: string) {
    setAdName(value);

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function handlePreviousPage() {
    setCurrentPage((page) => Math.max(page - 1, 1));
  }

  function handleNextPage() {
    setCurrentPage((page) => Math.min(page + 1, totalPages));
  }

  const advertisementCount = advertisements.length;
  const advertisementLabel =
    advertisementCount === 1 ? "Advertisement" : "Advertisements";

  return (
    <AppBackground className="px-6 py-10">
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

          <div className="rounded-full border border-[#4F8CFF]/35 bg-[#10284D]/45 px-5 py-3 text-sm font-semibold text-[#E7F0FF] shadow-[0_0_10px_#4F8CFF18]">
            {advertisementCount} {advertisementLabel}
          </div>
        </div>

        {!walletConnected && !isWalletRestoring && (
          <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm font-medium text-yellow-300">
            Connect your wallet to create or delete advertisements.
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
          <CreateAdvertisementCard
            adName={adName}
            errorMessage={errorMessage}
            isDisabled={isWalletRestoring}
            isCreateSuccessVisible={isCreateSuccessVisible}
            onAdNameChange={handleAdNameChange}
            onCreateAdvertisement={handleCreateAdvertisement}
          />

          <div>
            {advertisements.length === 0 ? (
              <EmptyAdvertisementsCard />
            ) : (
              <>
                <div className="grid gap-5 md:grid-cols-2">
                  {paginatedAdvertisements.map((advertisement) => (
                    <AdvertisementCard
                      key={`${advertisement.businessName}-${advertisement.name}`}
                      advertisement={advertisement}
                      editableName={editableAdvertisementName}
                      errorMessage={
                        editingAdvertisementName === advertisement.name
                          ? editErrorMessage
                          : ""
                      }
                      isEditing={
                        editingAdvertisementName === advertisement.name
                      }
                      isDeleteDisabled={isWalletRestoring}
                      isEditDisabled={isWalletRestoring}
                      onEditableNameChange={
                        handleEditableAdvertisementNameChange
                      }
                      onStartEdit={handleStartAdvertisementEdit}
                      onSaveEdit={handleSaveAdvertisementEdit}
                      onCancelEdit={handleCancelAdvertisementEdit}
                      onDelete={handleDeleteAdvertisement}
                    />
                  ))}
                </div>

                {shouldShowPagination && (
                  <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={handlePreviousPage}
                      disabled={visiblePage === 1}
                      className={paginationButtonClassName}
                    >
                      Prev
                    </button>

                    <p className="text-center font-medium">
                      Page {visiblePage} of {totalPages}
                    </p>

                    <button
                      type="button"
                      onClick={handleNextPage}
                      disabled={visiblePage === totalPages}
                      className={paginationButtonClassName}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </AppBackground>
  );
}
