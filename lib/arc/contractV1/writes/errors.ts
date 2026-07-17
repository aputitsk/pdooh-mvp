import type {
  ContractV1WriteError,
  ContractV1WriteErrorCode,
  ContractV1WriteStage,
} from "./types";

export function contractV1WriteError({
  code,
  stage,
  retryable = false,
}: {
  code: ContractV1WriteErrorCode;
  stage: ContractV1WriteStage;
  retryable?: boolean;
}): ContractV1WriteError {
  return {
    code,
    stage,
    retryable,
  };
}

export function classifyContractV1WriteError(
  error: unknown,
  defaultCode: ContractV1WriteErrorCode,
  stage: ContractV1WriteStage
): ContractV1WriteError {
  if (isUserRejectedRequest(error)) {
    return contractV1WriteError({
      code: "transaction_rejected",
      stage,
      retryable: false,
    });
  }

  if (isTransactionReverted(error)) {
    return contractV1WriteError({
      code: "transaction_reverted",
      stage,
      retryable: false,
    });
  }

  return contractV1WriteError({
    code: defaultCode,
    stage,
    retryable: true,
  });
}

export function receiptUnknownError(stage: ContractV1WriteStage) {
  return contractV1WriteError({
    code: "receipt_unknown",
    stage,
    retryable: true,
  });
}

function isUserRejectedRequest(error: unknown) {
  return inspectErrorTree(error, (value) => {
    if (typeof value === "object" && value !== null) {
      const record = value as Record<string, unknown>;

      if (record.code === 4001 || record.code === "4001") {
        return true;
      }
    }

    if (typeof value !== "string") {
      return false;
    }

    const lower = value.toLowerCase();

    return lower.includes("user rejected") || lower.includes("rejected the request");
  });
}

function isTransactionReverted(error: unknown) {
  return inspectErrorTree(error, (value) => {
    if (typeof value !== "string") {
      return false;
    }

    const lower = value.toLowerCase();

    return lower.includes("execution reverted") || lower.includes("transaction reverted");
  });
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
