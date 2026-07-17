import { getAddress, isAddress, zeroAddress, type Address } from "viem";

import {
  CONTRACT_V1_APP_MODE_ENV_NAME,
  getContractV1AppModeConfig,
} from "./appMode";
import type {
  ContractV1AppMode,
  ContractV1DiagnosticIssue,
  ContractV1Env,
} from "./types";

export const CONTRACT_V1_ESCROW_ADDRESS_ENV_NAME =
  "NEXT_PUBLIC_PDOOH_AUCTION_ESCROW_V2_ADDRESS";
export const CONTRACT_V1_ENGINE_ADDRESS_ENV_NAME =
  "NEXT_PUBLIC_PDOOH_AUCTION_ENGINE_V1_ADDRESS";

export type ContractV1AddressConfig = {
  mode: ContractV1AppMode;
  appModeRawValue: string | null;
  isContractMode: boolean;
  valid: boolean;
  escrowAddress: Address | null;
  engineAddress: Address | null;
  rawEscrowAddress: string | null;
  rawEngineAddress: string | null;
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

function parseContractV1Address(
  envName: string,
  rawValue: string | undefined,
  isRequired: boolean
) {
  const trimmedValue = rawValue?.trim();
  const warnings: ContractV1DiagnosticIssue[] = [];
  const errors: ContractV1DiagnosticIssue[] = [];

  function pushIssue(issue: ContractV1DiagnosticIssue) {
    if (isRequired) {
      errors.push(issue);
      return;
    }

    warnings.push(issue);
  }

  if (!trimmedValue) {
    if (isRequired) {
      errors.push(
        configIssue(
          "contract_v1_address_missing",
          `${envName} is required when ${CONTRACT_V1_APP_MODE_ENV_NAME} is contract_v1.`
        )
      );
    }

    return {
      address: null,
      warnings,
      errors,
    };
  }

  if (!isAddress(trimmedValue)) {
    pushIssue(
      configIssue(
        "contract_v1_address_invalid",
        `${envName} must be a valid EVM address.`,
        trimmedValue
      )
    );

    return {
      address: null,
      warnings,
      errors,
    };
  }

  if (trimmedValue.toLowerCase() === zeroAddress) {
    pushIssue(
      configIssue(
        "contract_v1_address_zero",
        `${envName} cannot be the zero address.`,
        trimmedValue
      )
    );

    return {
      address: null,
      warnings,
      errors,
    };
  }

  return {
    address: getAddress(trimmedValue),
    warnings,
    errors,
  };
}

export function getContractV1AddressConfig(
  env: ContractV1Env = process.env
): ContractV1AddressConfig {
  const appMode = getContractV1AppModeConfig(env);
  const escrow = parseContractV1Address(
    CONTRACT_V1_ESCROW_ADDRESS_ENV_NAME,
    env[CONTRACT_V1_ESCROW_ADDRESS_ENV_NAME],
    appMode.isContractMode
  );
  const engine = parseContractV1Address(
    CONTRACT_V1_ENGINE_ADDRESS_ENV_NAME,
    env[CONTRACT_V1_ENGINE_ADDRESS_ENV_NAME],
    appMode.isContractMode
  );
  const warnings = [
    ...appMode.warnings,
    ...escrow.warnings,
    ...engine.warnings,
  ];
  const errors = [
    ...appMode.errors,
    ...escrow.errors,
    ...engine.errors,
  ];

  return {
    mode: appMode.mode,
    appModeRawValue: appMode.rawValue,
    isContractMode: appMode.isContractMode,
    valid: errors.length === 0,
    escrowAddress: escrow.address,
    engineAddress: engine.address,
    rawEscrowAddress: env[CONTRACT_V1_ESCROW_ADDRESS_ENV_NAME] ?? null,
    rawEngineAddress: env[CONTRACT_V1_ENGINE_ADDRESS_ENV_NAME] ?? null,
    warnings,
    errors,
  };
}
