import type {
  ContractV1AppMode,
  ContractV1Bytes32,
  ContractV1SlotState,
} from "../types";
import type {
  ContractV1PhaseState,
  ContractV1SiteSupport,
  EligibilityResult,
} from "./types";

const UNFINALIZED_SLOT_OUTCOME = 0;
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export type ContractV1DepositEligibilityInput = {
  mode: ContractV1AppMode;
  configValid: boolean;
  chainMatched: boolean;
  walletConnected: boolean;
  amount: bigint;
};

export type ContractV1DepositFlowEligibilityInput =
  ContractV1DepositEligibilityInput & {
    siteSupport: ContractV1SiteSupport;
  };

export type ContractV1WithdrawEligibilityInput = {
  mode: ContractV1AppMode;
  configValid: boolean;
  chainMatched: boolean;
  walletConnected: boolean;
  amount: bigint;
  available: bigint;
};

export type ContractV1PlaceBidEligibilityInput = {
  mode: ContractV1AppMode;
  configValid: boolean;
  siteSupport: ContractV1SiteSupport;
  chainMatched: boolean;
  walletConnected: boolean;
  phase: ContractV1PhaseState;
  slotState: ContractV1SlotState;
  advertisementId: ContractV1Bytes32 | null | undefined;
  amount: bigint;
  available: bigint;
};

export function canDepositToV2Escrow({
  mode,
  configValid,
  chainMatched,
  walletConnected,
  amount,
}: ContractV1DepositEligibilityInput): EligibilityResult {
  const common = checkCommonWalletActionEligibility({
    mode,
    configValid,
    chainMatched,
    walletConnected,
  });

  if (!common.allowed) {
    return common;
  }

  if (amount <= BigInt(0)) {
    return blocked("invalid_amount");
  }

  return allowed();
}

export function canOpenContractV1DepositFlow({
  siteSupport,
  ...depositInput
}: ContractV1DepositFlowEligibilityInput): EligibilityResult {
  const depositEligibility = canDepositToV2Escrow(depositInput);

  if (!depositEligibility.allowed) {
    return depositEligibility;
  }

  if (!siteSupport.supported) {
    return blocked("unsupported_site");
  }

  return allowed();
}

export function canWithdraw({
  mode,
  configValid,
  chainMatched,
  walletConnected,
  amount,
  available,
}: ContractV1WithdrawEligibilityInput): EligibilityResult {
  const common = checkCommonWalletActionEligibility({
    mode,
    configValid,
    chainMatched,
    walletConnected,
  });

  if (!common.allowed) {
    return common;
  }

  if (amount <= BigInt(0)) {
    return blocked("invalid_amount");
  }

  if (amount > available) {
    return blocked("insufficient_available_balance");
  }

  return allowed();
}

export function canPlaceBid({
  mode,
  configValid,
  siteSupport,
  chainMatched,
  walletConnected,
  phase,
  slotState,
  advertisementId,
  amount,
  available,
}: ContractV1PlaceBidEligibilityInput): EligibilityResult {
  const common = checkCommonWalletActionEligibility({
    mode,
    configValid,
    chainMatched,
    walletConnected,
  });

  if (!common.allowed) {
    return common;
  }

  if (!siteSupport.supported) {
    return blocked("unsupported_site");
  }

  if (phase.phase !== "open") {
    return blocked("not_open");
  }

  if (slotState.outcome !== UNFINALIZED_SLOT_OUTCOME) {
    return blocked("slot_finalized");
  }

  if (!isUsableAdvertisementId(advertisementId)) {
    return blocked("missing_advertisement");
  }

  if (amount <= BigInt(0)) {
    return blocked("invalid_amount");
  }

  if (amount > available) {
    return blocked("insufficient_available_balance");
  }

  return allowed();
}

function checkCommonWalletActionEligibility({
  mode,
  configValid,
  chainMatched,
  walletConnected,
}: {
  mode: ContractV1AppMode;
  configValid: boolean;
  chainMatched: boolean;
  walletConnected: boolean;
}): EligibilityResult {
  if (mode !== "contract_v1") {
    return blocked("wrong_mode");
  }

  if (!configValid) {
    return blocked("invalid_config");
  }

  if (!chainMatched) {
    return blocked("wrong_chain");
  }

  if (!walletConnected) {
    return blocked("wallet_disconnected");
  }

  return allowed();
}

function isUsableAdvertisementId(
  advertisementId: ContractV1Bytes32 | null | undefined
) {
  return (
    typeof advertisementId === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(advertisementId) &&
    advertisementId.toLowerCase() !== ZERO_BYTES32
  );
}

function allowed(): EligibilityResult {
  return {
    allowed: true,
    code: "allowed",
  };
}

function blocked(code: Exclude<EligibilityResult["code"], "allowed">) {
  return {
    allowed: false,
    code,
  };
}
