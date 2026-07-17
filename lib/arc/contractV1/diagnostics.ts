import { getAddress, isAddress, type Address } from "viem";

import {
  ARC_CHAIN_ID,
  ARC_USDC_CONTRACT_ADDRESS,
} from "../arcConstants";
import { normalizeArcReadError } from "../arcReadErrors";
import { getContractV1AddressConfig } from "./config";
import {
  readContractV1CurrentCycleId,
  readContractV1CyclePreview,
  readContractV1CycleSnapshot,
  readContractV1EngineStaticConfig,
  readContractV1SiteConfigForCycle,
  readContractV1SlotDiagnostics,
} from "./engineReads";
import {
  readContractV1EscrowAccount,
  readContractV1EscrowStaticConfig,
  type ContractV1ReadClient,
} from "./escrowReads";
import { getContractV1SiteId } from "./siteIds";
import type {
  ContractV1Bytes32,
  ContractV1DiagnosticIssue,
  ContractV1Diagnostics,
  ContractV1Env,
} from "./types";

export type ContractV1DiagnosticsInput = {
  walletAddress: string;
  siteKey: string;
  cycleId?: bigint | number | string;
  env?: ContractV1Env;
  client?: ContractV1ReadClient;
};

function issue(
  kind: ContractV1DiagnosticIssue["kind"],
  code: string,
  message: string,
  details?: string
): ContractV1DiagnosticIssue {
  return {
    kind,
    code,
    message,
    details,
  };
}

function collectErrorText(
  error: unknown,
  visited = new WeakSet<object>()
): string[] {
  if (error instanceof Error) {
    const values = [error.name, error.message];

    if (error.cause !== undefined) {
      values.push(...collectErrorText(error.cause, visited));
    }

    return values;
  }

  if (typeof error === "string") {
    return [error];
  }

  if (typeof error !== "object" || error === null) {
    return [];
  }

  if (visited.has(error)) {
    return [];
  }

  visited.add(error);

  const record = error as Record<string, unknown>;
  const values: string[] = [];

  for (const field of ["message", "shortMessage", "details", "name"]) {
    const value = record[field];

    if (typeof value === "string") {
      values.push(value);
    }
  }

  if (record.cause !== undefined) {
    values.push(...collectErrorText(record.cause, visited));
  }

  if (record.error !== undefined) {
    values.push(...collectErrorText(record.error, visited));
  }

  return values;
}

function readIssue(label: string, error: unknown): ContractV1DiagnosticIssue {
  const details = collectErrorText(error).join(" | ") || undefined;
  const searchableDetails = details?.toLowerCase() ?? "";

  if (
    searchableDetails.includes("sitenotconfigured") ||
    searchableDetails.includes("invalidcycle") ||
    searchableDetails.includes("invalidslot")
  ) {
    return issue(
      "missing_state",
      "contract_v1_missing_onchain_state",
      `${label} is not available for the requested Contract V1 site/cycle.`,
      details
    );
  }

  const normalizedError = normalizeArcReadError(error);

  if (normalizedError.kind === "rate_limit") {
    return issue(
      "rpc",
      "contract_v1_rpc_rate_limited",
      normalizedError.message,
      details
    );
  }

  if (normalizedError.kind === "temporary") {
    return issue(
      "rpc",
      "contract_v1_rpc_read_failed",
      normalizedError.message,
      details
    );
  }

  return issue(
    "contract_read",
    "contract_v1_read_failed",
    normalizedError.message,
    details
  );
}

async function captureRead<T>(
  label: string,
  errors: ContractV1DiagnosticIssue[],
  read: () => Promise<T>
) {
  try {
    return await read();
  } catch (error) {
    errors.push(readIssue(label, error));
    return null;
  }
}

function parseOptionalCycleId(
  value: ContractV1DiagnosticsInput["cycleId"],
  errors: ContractV1DiagnosticIssue[]
) {
  if (value === undefined) {
    return null;
  }

  try {
    const cycleId =
      typeof value === "bigint"
        ? value
        : typeof value === "number"
          ? BigInt(value)
          : BigInt(value.trim());

    if (cycleId < BigInt(0)) {
      throw new RangeError("cycleId cannot be negative.");
    }

    return cycleId;
  } catch (error) {
    errors.push(
      issue(
        "config",
        "contract_v1_invalid_cycle_id",
        "Contract V1 diagnostics cycleId must be a non-negative integer.",
        error instanceof Error ? error.message : undefined
      )
    );

    return null;
  }
}

function sameAddress(left: Address, right: Address) {
  return left.toLowerCase() === right.toLowerCase();
}

function getSlotCountForDiagnostics(
  diagnostics: ContractV1Diagnostics
): number {
  if (diagnostics.persistedCycleSnapshot?.exists) {
    return diagnostics.persistedCycleSnapshot.slotCount;
  }

  if (diagnostics.previewCycle) {
    return diagnostics.previewCycle.slotCount;
  }

  return diagnostics.siteConfig?.slotCount ?? 0;
}

export async function getContractV1Diagnostics({
  walletAddress,
  siteKey,
  cycleId,
  env = process.env,
  client,
}: ContractV1DiagnosticsInput): Promise<ContractV1Diagnostics> {
  const addressConfig = getContractV1AddressConfig(env);
  const warnings = [...addressConfig.warnings];
  const errors = [...addressConfig.errors];
  let siteId: ContractV1Bytes32 | null = null;
  let checkedWalletAddress: Address | null = null;

  try {
    siteId = getContractV1SiteId(siteKey);
  } catch (error) {
    errors.push(
      issue(
        "config",
        "contract_v1_unknown_site_key",
        "Contract V1 diagnostics require a known app siteKey.",
        error instanceof Error ? error.message : undefined
      )
    );
  }

  if (isAddress(walletAddress)) {
    checkedWalletAddress = getAddress(walletAddress);
  } else {
    errors.push(
      issue(
        "config",
        "contract_v1_invalid_wallet_address",
        "Contract V1 diagnostics walletAddress must be a valid EVM address.",
        walletAddress
      )
    );
  }

  const diagnostics: ContractV1Diagnostics = {
    appMode: addressConfig.mode,
    appModeRawValue: addressConfig.appModeRawValue,
    v1ConfigValid: addressConfig.valid,
    chainId: ARC_CHAIN_ID,
    addresses: {
      escrowV2: addressConfig.escrowAddress,
      engineV1: addressConfig.engineAddress,
      escrowConfiguredEngine: null,
      engineConfiguredEscrow: null,
      usdc: null,
    },
    siteKey,
    siteId,
    currentCycleId: null,
    effectiveCycleId: null,
    previewCycle: null,
    persistedCycleSnapshot: null,
    siteConfig: null,
    slots: [],
    walletEscrow: null,
    invariants: [],
    warnings,
    errors,
  };

  if (!addressConfig.isContractMode) {
    return diagnostics;
  }

  if (
    !addressConfig.valid ||
    !addressConfig.escrowAddress ||
    !addressConfig.engineAddress ||
    !siteId ||
    !checkedWalletAddress
  ) {
    return diagnostics;
  }

  const readClient = client;
  const requestedCycleId = parseOptionalCycleId(cycleId, errors);

  const escrowStaticConfig = await captureRead(
    "AuctionEscrowV2 static config",
    errors,
    () =>
      readContractV1EscrowStaticConfig({
        client: readClient,
        escrowAddress: addressConfig.escrowAddress!,
      })
  );
  const engineStaticConfig = await captureRead(
    "AuctionEngineV1 static config",
    errors,
    () =>
      readContractV1EngineStaticConfig({
        client: readClient,
        engineAddress: addressConfig.engineAddress!,
      })
  );

  if (escrowStaticConfig) {
    diagnostics.addresses.escrowConfiguredEngine =
      escrowStaticConfig.engineAddress;
    diagnostics.addresses.usdc = escrowStaticConfig.usdcAddress;

    if (!sameAddress(escrowStaticConfig.engineAddress, addressConfig.engineAddress)) {
      errors.push(
        issue(
          "invariant",
          "contract_v1_escrow_engine_mismatch",
          "AuctionEscrowV2.engine() does not match the configured AuctionEngineV1 address."
        )
      );
    }

    if (!sameAddress(escrowStaticConfig.usdcAddress, ARC_USDC_CONTRACT_ADDRESS)) {
      errors.push(
        issue(
          "invariant",
          "contract_v1_usdc_mismatch",
          "AuctionEscrowV2.usdc() does not match the Arc Testnet USDC address."
        )
      );
    }
  }

  if (engineStaticConfig) {
    diagnostics.addresses.engineConfiguredEscrow =
      engineStaticConfig.escrowAddress;

    if (!sameAddress(engineStaticConfig.escrowAddress, addressConfig.escrowAddress)) {
      errors.push(
        issue(
          "invariant",
          "contract_v1_engine_escrow_mismatch",
          "AuctionEngineV1.escrow() does not match the configured AuctionEscrowV2 address."
        )
      );
    }
  }

  diagnostics.currentCycleId = await captureRead(
    "AuctionEngineV1.currentCycleId",
    errors,
    () =>
      readContractV1CurrentCycleId({
        client: readClient,
        engineAddress: addressConfig.engineAddress!,
        siteId,
      })
  );
  diagnostics.effectiveCycleId = requestedCycleId ?? diagnostics.currentCycleId;

  if (diagnostics.effectiveCycleId === null) {
    return diagnostics;
  }

  diagnostics.previewCycle = await captureRead(
    "AuctionEngineV1.previewCycle",
    errors,
    () =>
      readContractV1CyclePreview({
        client: readClient,
        engineAddress: addressConfig.engineAddress!,
        siteId,
        cycleId: diagnostics.effectiveCycleId!,
      })
  );
  diagnostics.persistedCycleSnapshot = await captureRead(
    "AuctionEngineV1.getCycleSnapshot",
    errors,
    () =>
      readContractV1CycleSnapshot({
        client: readClient,
        engineAddress: addressConfig.engineAddress!,
        siteId,
        cycleId: diagnostics.effectiveCycleId!,
      })
  );
  diagnostics.siteConfig = await captureRead(
    "AuctionEngineV1.getSiteConfigForCycle",
    errors,
    () =>
      readContractV1SiteConfigForCycle({
        client: readClient,
        engineAddress: addressConfig.engineAddress!,
        siteId,
        cycleId: diagnostics.effectiveCycleId!,
      })
  );

  if (diagnostics.persistedCycleSnapshot?.exists === false) {
    warnings.push(
      issue(
        "missing_snapshot",
        "contract_v1_cycle_snapshot_missing",
        "No persisted cycle snapshot exists yet; diagnostics are using preview/config reads for slot iteration."
      )
    );
  }

  const slotCount = getSlotCountForDiagnostics(diagnostics);

  if (slotCount > 0) {
    diagnostics.slots = await captureRead(
      "AuctionEngineV1 slot reads",
      errors,
      () =>
        readContractV1SlotDiagnostics({
          client: readClient,
          engineAddress: addressConfig.engineAddress!,
          siteId,
          cycleId: diagnostics.effectiveCycleId!,
          slotCount,
        })
    ) ?? [];
  }

  diagnostics.walletEscrow = await captureRead(
    "AuctionEscrowV2 wallet escrow account",
    errors,
    () =>
      readContractV1EscrowAccount({
        client: readClient,
        escrowAddress: addressConfig.escrowAddress!,
        walletAddress: checkedWalletAddress!,
      })
  );

  if (diagnostics.walletEscrow) {
    const invariantOk =
      diagnostics.walletEscrow.available + diagnostics.walletEscrow.reserved ===
      diagnostics.walletEscrow.balance;

    diagnostics.invariants.push({
      code: "contract_v1_escrow_balance_conservation",
      ok: invariantOk,
      message:
        "AuctionEscrowV2 available + reserved should equal balance for the wallet.",
    });

    if (!invariantOk) {
      errors.push(
        issue(
          "invariant",
          "contract_v1_escrow_balance_conservation_failed",
          "AuctionEscrowV2 wallet accounting invariant failed: available + reserved != balance."
        )
      );
    }
  }

  return diagnostics;
}
