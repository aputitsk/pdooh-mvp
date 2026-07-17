import type {
  ContractV1ReadContractClient,
  ContractV1ReceiptClient,
  ContractV1TransactionRecoveryMetadata,
  ContractV1TransactionReceipt,
  ContractV1WriteError,
  ContractV1WriteErrorCode,
  ContractV1WriteResult,
  ContractV1WriteStage,
} from "./types";

export function contractV1WriteFailure({
  code,
  stage,
  retryable = false,
  recovery,
}: {
  code: ContractV1WriteErrorCode;
  stage: ContractV1WriteStage;
  retryable?: boolean;
  recovery?: ContractV1TransactionRecoveryMetadata;
}): ContractV1WriteResult<never> {
  return {
    ok: false,
    error: contractV1WriteError({
      code,
      stage,
      retryable,
      recovery,
    }),
  };
}

export function contractV1WriteError({
  code,
  stage,
  retryable = false,
  recovery,
}: {
  code: ContractV1WriteErrorCode;
  stage: ContractV1WriteStage;
  retryable?: boolean;
  recovery?: ContractV1TransactionRecoveryMetadata;
}): ContractV1WriteError {
  return {
    code,
    stage,
    retryable,
    recovery,
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

export function receiptUnknownFailure(
  stage: ContractV1WriteStage,
  recovery: ContractV1TransactionRecoveryMetadata
): ContractV1WriteResult<never> {
  return contractV1WriteFailure({
    code: "receipt_unknown",
    stage,
    retryable: true,
    recovery,
  });
}

export async function waitForContractV1Receipt(
  receiptClient: ContractV1ReceiptClient,
  recovery: ContractV1TransactionRecoveryMetadata
): Promise<ContractV1WriteResult<ContractV1TransactionReceipt>> {
  try {
    return {
      ok: true,
      value: await receiptClient.waitForTransactionReceipt({
        hash: recovery.transactionHash,
      }),
    };
  } catch {
    return receiptUnknownFailure("receipt", recovery);
  }
}

export async function readContractV1BigInt({
  readClient,
  request,
  stage,
}: {
  readClient: ContractV1ReadContractClient;
  request: Parameters<ContractV1ReadContractClient["readContract"]>[0];
  stage: ContractV1WriteStage;
}): Promise<ContractV1WriteResult<bigint>> {
  try {
    return {
      ok: true,
      value: asBigInt(await readClient.readContract(request)),
    };
  } catch {
    return contractV1WriteFailure({
      code: "read_failed",
      stage,
      retryable: true,
    });
  }
}

export async function getContractV1ReadBlockNumber(
  readClient: ContractV1ReadContractClient,
  stage: ContractV1WriteStage
): Promise<ContractV1WriteResult<bigint>> {
  if (!readClient.getBlockNumber) {
    return contractV1WriteFailure({
      code: "read_failed",
      stage,
      retryable: true,
    });
  }

  try {
    return {
      ok: true,
      value: await readClient.getBlockNumber(),
    };
  } catch {
    return contractV1WriteFailure({
      code: "read_failed",
      stage,
      retryable: true,
    });
  }
}

function asBigInt(value: unknown) {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }

  throw new TypeError("Contract V1 write read must return an integer.");
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
