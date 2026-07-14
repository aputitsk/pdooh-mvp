"use client";

import { useSyncExternalStore } from "react";
import {
  createDefaultAdvertisement,
  getAdvertisements,
  updateAdvertisementsBusinessName,
  type Advertisement,
} from "@/lib/advertisements/advertisements";
import {
  getStoredAdvertiserBalance,
  getStoredBusinessName,
  getStoredBusinessProfileCreated,
  setStoredAdvertiserBalance,
  setStoredBusinessName,
  setStoredBusinessProfileCreated,
} from "@/lib/advertiser/advertiserStorage";
import {
  getWalletState,
  subscribeToWalletChanges,
  type WalletState,
} from "@/lib/wallet";
import {
  formatUSDCFromMinorUnits,
  parseUSDCToMinorUnits,
  type UsdcMinorUnits,
} from "@/lib/money/usdc";

type CreateBusinessProfileResult = {
  createdDefaultAdvertisement: boolean;
};

const emptyWalletState: WalletState = {
  status: "restoring",
  connected: false,
  address: null,
  chainId: null,
  source: null,
};

const emptyAdvertisements: Advertisement[] = [];
const demoStorageEventName = "pdooh-demo-storage-change";

let cachedWalletState = emptyWalletState;
let cachedAdvertisements = emptyAdvertisements;
let cachedAdvertisementsJson = "";

function notifyDemoStorageChange() {
  window.dispatchEvent(new Event(demoStorageEventName));
}

function subscribeToDemoStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(demoStorageEventName, onStoreChange);
  const unsubscribeFromWalletChanges = subscribeToWalletChanges(onStoreChange);

  const syncInterval = window.setInterval(onStoreChange, 500);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(demoStorageEventName, onStoreChange);
    unsubscribeFromWalletChanges();
    window.clearInterval(syncInterval);
  };
}

function getCurrentWalletAddress() {
  const wallet = getWalletState();

  return wallet.connected ? wallet.address : null;
}

function getWalletSnapshot() {
  const nextWalletState = getWalletState();

  if (
    cachedWalletState.connected === nextWalletState.connected &&
    cachedWalletState.address === nextWalletState.address &&
    cachedWalletState.status === nextWalletState.status &&
    cachedWalletState.chainId === nextWalletState.chainId &&
    cachedWalletState.source === nextWalletState.source
  ) {
    return cachedWalletState;
  }

  cachedWalletState = nextWalletState;
  return cachedWalletState;
}

function getServerWalletSnapshot() {
  return emptyWalletState;
}

function getBusinessNameSnapshot() {
  return getStoredBusinessName(getCurrentWalletAddress());
}

function getServerBusinessNameSnapshot() {
  return "";
}

function getBusinessProfileCreatedSnapshot() {
  return getStoredBusinessProfileCreated(getCurrentWalletAddress());
}

function getServerBusinessProfileCreatedSnapshot() {
  return false;
}

function getBalanceSnapshot() {
  return getStoredAdvertiserBalance(getCurrentWalletAddress());
}

function getServerBalanceSnapshot() {
  return 0;
}

function getAdvertisementsSnapshot() {
  const nextAdvertisements = getAdvertisements(getCurrentWalletAddress());
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

function setBusinessName(businessName: string) {
  setStoredBusinessName(businessName, getCurrentWalletAddress());
  notifyDemoStorageChange();
}

function createBusinessProfile(
  businessName: string
): CreateBusinessProfileResult {
  const walletAddress = getCurrentWalletAddress();
  const trimmedBusinessName = businessName.trim();

  if (!walletAddress || !trimmedBusinessName) {
    return { createdDefaultAdvertisement: false };
  }

  setStoredBusinessName(trimmedBusinessName, walletAddress);
  setStoredBusinessProfileCreated(true, walletAddress);

  const currentAdvertisements = getAdvertisements(walletAddress);
  const nextAdvertisements = createDefaultAdvertisement(
    currentAdvertisements,
    trimmedBusinessName,
    walletAddress
  );

  notifyDemoStorageChange();

  return {
    createdDefaultAdvertisement:
      nextAdvertisements.length > currentAdvertisements.length,
  };
}

function updateBusinessProfileName(businessName: string) {
  const walletAddress = getCurrentWalletAddress();
  const trimmedBusinessName = businessName.trim();

  if (!walletAddress || !trimmedBusinessName) {
    return false;
  }

  setStoredBusinessName(trimmedBusinessName, walletAddress);
  updateAdvertisementsBusinessName(
    getAdvertisements(walletAddress),
    trimmedBusinessName,
    walletAddress
  );
  notifyDemoStorageChange();

  return true;
}

function depositTestUSDC(amount: string) {
  const walletAddress = getCurrentWalletAddress();
  let deposit: UsdcMinorUnits;

  if (!walletAddress) {
    return false;
  }

  try {
    deposit = parseUSDCToMinorUnits(amount);
  } catch {
    return false;
  }

  if (deposit <= 0) {
    return false;
  }

  const savedBalance = getStoredAdvertiserBalance(walletAddress);
  const nextBalance = savedBalance + deposit;

  setStoredAdvertiserBalance(nextBalance, walletAddress);
  notifyDemoStorageChange();

  return true;
}

export function useDemoAdvertiserStore() {
  const wallet = useSyncExternalStore(
    subscribeToWalletChanges,
    getWalletSnapshot,
    getServerWalletSnapshot
  );

  const businessName = useSyncExternalStore(
    subscribeToDemoStorage,
    getBusinessNameSnapshot,
    getServerBusinessNameSnapshot
  );

  const isBusinessProfileCreated = useSyncExternalStore(
    subscribeToDemoStorage,
    getBusinessProfileCreatedSnapshot,
    getServerBusinessProfileCreatedSnapshot
  );

  const balance = useSyncExternalStore(
    subscribeToDemoStorage,
    getBalanceSnapshot,
    getServerBalanceSnapshot
  );

  const advertisements = useSyncExternalStore(
    subscribeToDemoStorage,
    getAdvertisementsSnapshot,
    getServerAdvertisementsSnapshot
  );

  return {
    wallet,
    businessName,
    isBusinessProfileCreated,
    balance,
    formattedBalance: formatUSDCFromMinorUnits(balance),
    advertisements,
    setBusinessName,
    createBusinessProfile,
    updateBusinessProfileName,
    depositTestUSDC,
  };
}
