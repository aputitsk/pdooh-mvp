export type ContractV1RuntimeErrorKind =
  | "configuration"
  | "unsupported_site"
  | "wrong_chain"
  | "rpc_unavailable"
  | "contract_read_failed"
  | "snapshot_missing"
  | "stale_state"
  | "action_not_eligible"
  | "insufficient_available_balance";

export type ContractV1RuntimeError = {
  kind: ContractV1RuntimeErrorKind;
  code: string;
  retryable: boolean;
};

export function contractV1RuntimeError(
  kind: ContractV1RuntimeErrorKind,
  code: string,
  retryable = false
): ContractV1RuntimeError {
  return {
    kind,
    code,
    retryable,
  };
}

export function isContractV1SiteNotConfiguredError(error: unknown) {
  return inspectErrorTree(error, (value) => {
    if (typeof value === "object" && value !== null) {
      const record = value as Record<string, unknown>;

      if (
        record.errorName === "SiteNotConfigured" ||
        record.name === "SiteNotConfigured"
      ) {
        return true;
      }

      const decodedError = record.error;

      if (typeof decodedError === "object" && decodedError !== null) {
        const decodedRecord = decodedError as Record<string, unknown>;

        if (
          decodedRecord.errorName === "SiteNotConfigured" ||
          decodedRecord.name === "SiteNotConfigured"
        ) {
          return true;
        }
      }
    }

    if (typeof value !== "string") {
      return false;
    }

    return textMeansSiteNotConfigured(value);
  });
}

export function classifyContractV1ReadError(
  error: unknown
): ContractV1RuntimeError {
  const searchableText = collectErrorText(error).join(" ").toLowerCase();

  if (
    searchableText.includes("rate limit") ||
    searchableText.includes("timeout") ||
    searchableText.includes("timed out") ||
    searchableText.includes("network") ||
    searchableText.includes("fetch failed") ||
    searchableText.includes("econnreset")
  ) {
    return contractV1RuntimeError(
      "rpc_unavailable",
      "contract_v1_rpc_unavailable",
      true
    );
  }

  return contractV1RuntimeError(
    "contract_read_failed",
    "contract_v1_contract_read_failed",
    true
  );
}

function collectErrorText(error: unknown): string[] {
  if (error instanceof Error) {
    const values = [error.name, error.message];

    if (error.cause !== undefined) {
      values.push(...collectErrorText(error.cause));
    }

    return values;
  }

  if (typeof error === "string") {
    return [error];
  }

  if (typeof error !== "object" || error === null) {
    return [];
  }

  const record = error as Record<string, unknown>;
  const values: string[] = [];

  for (const field of ["name", "message", "shortMessage", "details"]) {
    const value = record[field];

    if (typeof value === "string") {
      values.push(value);
    }
  }

  if (record.cause !== undefined) {
    values.push(...collectErrorText(record.cause));
  }

  return values;
}

function inspectErrorTree(
  error: unknown,
  predicate: (value: unknown) => boolean,
  visited = new WeakSet<object>()
): boolean {
  if (predicate(error)) {
    return true;
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  if (visited.has(error)) {
    return false;
  }

  visited.add(error);

  const record = error as Record<string, unknown>;

  return (
    inspectErrorTree(record.name, predicate, visited) ||
    inspectErrorTree(record.message, predicate, visited) ||
    inspectErrorTree(record.shortMessage, predicate, visited) ||
    inspectErrorTree(record.details, predicate, visited) ||
    inspectErrorTree(record.cause, predicate, visited) ||
    inspectErrorTree(record.error, predicate, visited)
  );
}

function textMeansSiteNotConfigured(text: string) {
  const lower = text.toLowerCase();

  return (
    lower.includes("sitenotconfigured") ||
    lower.includes("site not configured")
  );
}
