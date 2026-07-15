export const ARC_READ_RATE_LIMIT_MESSAGE =
  "Arc Testnet is temporarily busy. Please try again shortly.";
export const ARC_READ_UNAVAILABLE_MESSAGE =
  "Unable to read data from Arc Testnet. Please try again shortly.";

export type ArcReadErrorKind = "configuration" | "rate_limit" | "temporary";

export type ArcReadErrorMessage = {
  kind: ArcReadErrorKind;
  message: string;
};

const configurationMessages = new Set([
  "Wallet address is not a valid EVM address.",
  "NEXT_PUBLIC_PDOOH_ESCROW_ADDRESS is not configured.",
  "NEXT_PUBLIC_PDOOH_ESCROW_ADDRESS must be a valid EVM address.",
  "NEXT_PUBLIC_PDOOH_ESCROW_ADDRESS cannot be the zero address.",
  "Configured pDOOH escrow address has no contract bytecode on Arc Testnet.",
  "Configured pDOOH escrow does not use the Arc Testnet ERC-20 USDC address.",
  "Configured pDOOH escrow Treasury does not match the application Treasury.",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  if (!isRecord(error)) {
    return [];
  }

  if (visited.has(error)) {
    return [];
  }

  visited.add(error);

  const values: string[] = [];
  const stringFields = ["message", "shortMessage", "details", "name"];
  const codeFields = ["code", "status", "statusCode"];

  for (const field of stringFields) {
    const value = error[field];

    if (typeof value === "string") {
      values.push(value);
    }
  }

  for (const field of codeFields) {
    const value = error[field];

    if (typeof value === "number" || typeof value === "string") {
      values.push(String(value));
    }
  }

  if (error.cause !== undefined) {
    values.push(...collectErrorText(error.cause, visited));
  }

  if (error.error !== undefined) {
    values.push(...collectErrorText(error.error, visited));
  }

  return values;
}

function getPrimaryMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (!isRecord(error)) {
    return null;
  }

  const message = error.message;
  const shortMessage = error.shortMessage;

  if (typeof message === "string") {
    return message;
  }

  if (typeof shortMessage === "string") {
    return shortMessage;
  }

  return null;
}

export function isArcReadRateLimitError(error: unknown) {
  const text = collectErrorText(error).join(" ").toLowerCase();

  return (
    text.includes("request limit reached") ||
    text.includes("rate limit") ||
    text.includes("rate limited") ||
    text.includes("too many requests") ||
    /\b429\b/.test(text)
  );
}

export function normalizeArcReadError(error: unknown): ArcReadErrorMessage {
  const primaryMessage = getPrimaryMessage(error);

  if (primaryMessage && configurationMessages.has(primaryMessage)) {
    return {
      kind: "configuration",
      message: primaryMessage,
    };
  }

  if (isArcReadRateLimitError(error)) {
    return {
      kind: "rate_limit",
      message: ARC_READ_RATE_LIMIT_MESSAGE,
    };
  }

  return {
    kind: "temporary",
    message: ARC_READ_UNAVAILABLE_MESSAGE,
  };
}
