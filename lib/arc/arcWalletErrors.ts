export function normalizeWalletError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  if (typeof error === "object" && error !== null) {
    const walletError = error as {
      code?: unknown;
      message?: unknown;
      shortMessage?: unknown;
    };
    const message =
      typeof walletError.message === "string"
        ? walletError.message
        : typeof walletError.shortMessage === "string"
          ? walletError.shortMessage
          : "Login failed";

    const normalizedError = new Error(
      walletError.code === undefined
        ? message
        : `${message} (code: ${String(walletError.code)})`,
      { cause: error }
    );

    return normalizedError;
  }

  return new Error("Login failed", { cause: error });
}

export function isUnknownChainError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const walletError = error as {
    code?: unknown;
    message?: unknown;
    shortMessage?: unknown;
  };
  const message = `${String(walletError.message ?? "")} ${String(
    walletError.shortMessage ?? ""
  )}`.toLowerCase();

  return (
    walletError.code === 4902 ||
    walletError.code === "4902" ||
    ((walletError.code === -32603 || walletError.code === "-32603") &&
      (message.includes("unrecognized chain id") ||
        message.includes("unknown chain")))
  );
}
