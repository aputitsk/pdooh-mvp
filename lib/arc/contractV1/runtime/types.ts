import type { ContractV1Bytes32 } from "../types";

export type ContractV1PhaseState =
  | {
      phase: "not_started";
      currentSlotIndex: null;
    }
  | {
      phase: "open";
      currentSlotIndex: null;
    }
  | {
      phase: "locked";
      currentSlotIndex: null;
    }
  | {
      phase: "live";
      currentSlotIndex: number;
    }
  | {
      phase: "ended";
      currentSlotIndex: null;
    };

export type ContractV1SiteSupport =
  | {
      supported: true;
      siteId: ContractV1Bytes32;
    }
  | {
      supported: false;
      reason: "invalid_site_key" | "not_configured" | "config_unavailable";
    };

export type EligibilityCode =
  | "allowed"
  | "wrong_mode"
  | "invalid_config"
  | "unsupported_site"
  | "wrong_chain"
  | "wallet_disconnected"
  | "not_open"
  | "slot_finalized"
  | "missing_advertisement"
  | "invalid_amount"
  | "insufficient_available_balance";

export type EligibilityResult = {
  allowed: boolean;
  code: EligibilityCode;
};
