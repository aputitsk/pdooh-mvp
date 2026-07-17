import type {
  ContractV1AppMode,
  ContractV1DiagnosticIssue,
  ContractV1Env,
} from "./types";

export const CONTRACT_V1_APP_MODE_ENV_NAME =
  "NEXT_PUBLIC_PDOOH_AUCTION_MODE";

export type ContractV1AppModeConfig = {
  mode: ContractV1AppMode;
  rawValue: string | null;
  isContractMode: boolean;
  valid: boolean;
  warnings: ContractV1DiagnosticIssue[];
  errors: ContractV1DiagnosticIssue[];
};

function configIssue(
  code: string,
  message: string,
  details?: string
): ContractV1DiagnosticIssue {
  return {
    kind: "config",
    code,
    message,
    details,
  };
}

export function getContractV1AppModeConfig(
  env: ContractV1Env = process.env
): ContractV1AppModeConfig {
  const rawValue = env[CONTRACT_V1_APP_MODE_ENV_NAME] ?? null;
  const normalizedValue = rawValue?.trim().toLowerCase();
  const warnings: ContractV1DiagnosticIssue[] = [];
  const errors: ContractV1DiagnosticIssue[] = [];

  if (!normalizedValue) {
    return {
      mode: "legacy",
      rawValue,
      isContractMode: false,
      valid: true,
      warnings,
      errors,
    };
  }

  if (normalizedValue === "legacy" || normalizedValue === "contract_v1") {
    return {
      mode: normalizedValue,
      rawValue,
      isContractMode: normalizedValue === "contract_v1",
      valid: true,
      warnings,
      errors,
    };
  }

  errors.push(
    configIssue(
      "contract_v1_unknown_app_mode",
      `${CONTRACT_V1_APP_MODE_ENV_NAME} must be "legacy" or "contract_v1"; falling back to legacy.`,
      rawValue ?? undefined
    )
  );

  return {
    mode: "legacy",
    rawValue,
    isContractMode: false,
    valid: false,
    warnings,
    errors,
  };
}
