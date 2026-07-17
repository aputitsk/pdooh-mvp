import type { ContractV1AddressConfig } from "../config";
import type { ContractV1Bytes32, ContractV1SiteConfig } from "../types";
import type { ContractV1SiteSupport } from "./types";

export type ContractV1RuntimeModeConfig = Pick<
  ContractV1AddressConfig,
  | "mode"
  | "isContractMode"
  | "valid"
  | "escrowAddress"
  | "engineAddress"
  | "warnings"
  | "errors"
>;

export type ContractV1SiteConfigProbe = Pick<
  ContractV1SiteConfig,
  "exists"
> | null | undefined;

export type ContractV1SiteConfigProbeReader = (
  siteId: ContractV1Bytes32
) => ContractV1SiteConfigProbe | Promise<ContractV1SiteConfigProbe>;

export type ContractV1SiteIdResolver = (
  siteKey: string
) => ContractV1Bytes32;

export type ContractV1SiteNotConfiguredClassifier = (
  error: unknown
) => boolean;

export function toContractV1RuntimeModeConfig(
  config: ContractV1AddressConfig
): ContractV1RuntimeModeConfig {
  return {
    mode: config.mode,
    isContractMode: config.isContractMode,
    valid: config.valid,
    escrowAddress: config.escrowAddress,
    engineAddress: config.engineAddress,
    warnings: config.warnings,
    errors: config.errors,
  };
}

export function resolveContractV1LocalSiteId({
  siteKey,
  resolveSiteId,
}: {
  siteKey: string;
  resolveSiteId: ContractV1SiteIdResolver;
}): ContractV1SiteSupport {
  try {
    return {
      supported: true,
      siteId: resolveSiteId(siteKey),
    };
  } catch {
    return {
      supported: false,
      reason: "invalid_site_key",
    };
  }
}

export async function resolveContractV1SiteSupport({
  siteKey,
  resolveSiteId,
  readSiteConfig,
  isSiteNotConfiguredError,
}: {
  siteKey: string;
  resolveSiteId: ContractV1SiteIdResolver;
  readSiteConfig: ContractV1SiteConfigProbeReader;
  isSiteNotConfiguredError: ContractV1SiteNotConfiguredClassifier;
}): Promise<ContractV1SiteSupport> {
  const localSite = resolveContractV1LocalSiteId({
    siteKey,
    resolveSiteId,
  });

  if (!localSite.supported) {
    return localSite;
  }

  try {
    const siteConfig = await readSiteConfig(localSite.siteId);

    if (!siteConfig?.exists) {
      return {
        supported: false,
        reason: "not_configured",
      };
    }

    return localSite;
  } catch (error) {
    if (isSiteNotConfiguredError(error)) {
      return {
        supported: false,
        reason: "not_configured",
      };
    }

    return {
      supported: false,
      reason: "config_unavailable",
    };
  }
}
