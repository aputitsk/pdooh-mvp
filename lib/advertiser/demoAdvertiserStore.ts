"use client";

import { useSyncExternalStore } from "react";
import {
  createDefaultAdvertisement,
  getAdvertisements,
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

  const syncInterval = window.setInterval(onStoreChange, 500);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(demoStorageEventName, onStoreChange);
    window.clearInterval(syncInterval);
  };
}

function getWalletSnapshot() {
  const nextWalletState = getWalletState();

  if (
    cachedWalletState.connected === nextWalletState.connected &&
    cachedWalletState.address === nextWalletState.address &&
    cachedWalletState.status === nextWalletState.status
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
  return getStoredBusinessName();
}

function getServerBusinessNameSnapshot() {
  return "";
}

function getBusinessProfileCreatedSnapshot() {
  return getStoredBusinessProfileCreated();
}

function getServerBusinessProfileCreatedSnapshot() {
  return false;
}

function getBalanceSnapshot() {
  return getStoredAdvertiserBalance();
}

function getServerBalanceSnapshot() {
  return 0;
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

function setBusinessName(businessName: string) {
  setStoredBusinessName(businessName);
  notifyDemoStorageChange();
}

function createBusinessProfile(
  businessName: string
): CreateBusinessProfileResult {
  const trimmedBusinessName = businessName.trim();

  if (!trimmedBusinessName) {
    return { createdDefaultAdvertisement: false };
  }

  setStoredBusinessName(trimmedBusinessName);
  setStoredBusinessProfileCreated(true);

  const currentAdvertisements = getAdvertisements();
  const nextAdvertisements = createDefaultAdvertisement(
    currentAdvertisements,
    trimmedBusinessName
  );

  notifyDemoStorageChange();

  return {
    createdDefaultAdvertisement:
      nextAdvertisements.length > currentAdvertisements.length,
  };
}

function depositTestUSDC(amount: string) {
  let deposit: UsdcMinorUnits;

  try {
    deposit = parseUSDCToMinorUnits(amount);
  } catch {
    return false;
  }

  if (deposit <= 0) {
    return false;
  }

  const savedBalance = getStoredAdvertiserBalance();
  const nextBalance = savedBalance + deposit;

  setStoredAdvertiserBalance(nextBalance);
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
    depositTestUSDC,
  };
}
