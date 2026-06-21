"use client";

import { useSyncExternalStore } from "react";
import {
  createDefaultAdvertisement,
  getAdvertisements,
  type Advertisement,
} from "@/lib/advertisements/advertisements";
import { getWalletState } from "@/lib/wallet/mockWallet";
import { subscribeToWalletChanges } from "@/lib/wallet/walletEvents";
import type { WalletState } from "@/lib/wallet/walletTypes";

type CreateCompanyResult = {
  createdDefaultAdvertisement: boolean;
};

const emptyWalletState: WalletState = {
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
    cachedWalletState.address === nextWalletState.address
  ) {
    return cachedWalletState;
  }

  cachedWalletState = nextWalletState;
  return cachedWalletState;
}

function getServerWalletSnapshot() {
  return emptyWalletState;
}

function getCompanyNameSnapshot() {
  return localStorage.getItem("pdooh-company-name") || "";
}

function getServerCompanyNameSnapshot() {
  return "";
}

function getCompanyCreatedSnapshot() {
  return localStorage.getItem("pdooh-company-created") === "true";
}

function getServerCompanyCreatedSnapshot() {
  return false;
}

function getBalanceSnapshot() {
  return localStorage.getItem("pdooh-balance") || "0";
}

function getServerBalanceSnapshot() {
  return "0";
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

function setCompanyName(companyName: string) {
  localStorage.setItem("pdooh-company-name", companyName);
  notifyDemoStorageChange();
}

function createCompany(companyName: string): CreateCompanyResult {
  const trimmedCompanyName = companyName.trim();

  if (!trimmedCompanyName) {
    return { createdDefaultAdvertisement: false };
  }

  localStorage.setItem("pdooh-company-name", trimmedCompanyName);
  localStorage.setItem("pdooh-company-created", "true");

  const currentAdvertisements = getAdvertisements();
  const nextAdvertisements = createDefaultAdvertisement(
    currentAdvertisements,
    trimmedCompanyName
  );

  notifyDemoStorageChange();

  return {
    createdDefaultAdvertisement:
      nextAdvertisements.length > currentAdvertisements.length,
  };
}

function depositTestUSDC(amount: string, currentBalance: string) {
  const deposit = Number(amount);

  if (!deposit || deposit <= 0) {
    return false;
  }

  const savedBalance = Number(
    localStorage.getItem("pdooh-balance") || currentBalance
  );

  const nextBalance = String(savedBalance + deposit);

  localStorage.setItem("pdooh-balance", nextBalance);
  notifyDemoStorageChange();

  return true;
}

export function useDemoAdvertiserStore() {
  const wallet = useSyncExternalStore(
    subscribeToWalletChanges,
    getWalletSnapshot,
    getServerWalletSnapshot
  );

  const companyName = useSyncExternalStore(
    subscribeToDemoStorage,
    getCompanyNameSnapshot,
    getServerCompanyNameSnapshot
  );

  const isCompanyCreated = useSyncExternalStore(
    subscribeToDemoStorage,
    getCompanyCreatedSnapshot,
    getServerCompanyCreatedSnapshot
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
    companyName,
    isCompanyCreated,
    balance,
    advertisements,
    setCompanyName,
    createCompany,
    depositTestUSDC,
  };
}