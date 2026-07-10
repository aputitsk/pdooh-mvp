"use client";

export type ArcNetworkSwitchState = {
  status: "idle" | "switching" | "error" | "reconnect_required";
  message: string | null;
};

export type ArcNetworkSwitchErrorContext = {
  chainIdBefore?: number | null;
  connectorId?: string | null;
  connectorName?: string | null;
  connectorType?: string | null;
  connectorUid?: string | null;
  isWalletConnect?: boolean;
  sessionChainIds?: number[] | null;
  sessionIncludesArc?: boolean | null;
};

type ArcNetworkConnectionAttempt = {
  id: number;
  startedAtMs: number;
};

const idleSwitchState: ArcNetworkSwitchState = {
  status: "idle",
  message: null,
};

let connectionAttempt: ArcNetworkConnectionAttempt | null = null;
let connectionAttemptId = 0;
let switchState = idleSwitchState;
const switchStateListeners = new Set<() => void>();

function emitSwitchStateChanged() {
  switchStateListeners.forEach((listener) => listener());
}

function setSwitchState(nextState: ArcNetworkSwitchState) {
  switchState = nextState;
  emitSwitchStateChanged();
}

function getNestedErrorCode(error: unknown): number | string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if (
    "code" in error &&
    (typeof error.code === "number" || typeof error.code === "string")
  ) {
    return error.code;
  }

  if ("cause" in error) {
    return getNestedErrorCode(error.cause);
  }

  return null;
}

function isUserRejectedError(code: number | string | null, message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    code === 4001 ||
    normalizedMessage.includes("user rejected") ||
    normalizedMessage.includes("user denied") ||
    normalizedMessage.includes("rejected")
  );
}

const walletConnectReconnectMessage =
  "Arc Testnet is not enabled for this wallet connection.\n\nReconnect your wallet to enable Arc Testnet.";

export function markArcNetworkConnectionAttempt() {
  connectionAttemptId += 1;
  connectionAttempt = {
    id: connectionAttemptId,
    startedAtMs: Date.now(),
  };
  setSwitchState(idleSwitchState);
}

export function getArcNetworkConnectionAttempt() {
  return connectionAttempt;
}

export function consumeArcNetworkConnectionAttempt() {
  const attempt = connectionAttempt;
  connectionAttempt = null;
  return attempt;
}

export function clearArcNetworkConnectionAttempt() {
  connectionAttempt = null;
}

export function getArcNetworkSwitchState() {
  return switchState;
}

export function subscribeToArcNetworkSwitchState(listener: () => void) {
  switchStateListeners.add(listener);

  return () => {
    switchStateListeners.delete(listener);
  };
}

export function setArcNetworkSwitching() {
  setSwitchState({
    status: "switching",
    message: "Confirm the network switch in your wallet.",
  });
}

export function clearArcNetworkSwitchState() {
  setSwitchState(idleSwitchState);
}

export function formatArcNetworkSwitchError(
  error: unknown,
  context?: ArcNetworkSwitchErrorContext
) {
  const code = getNestedErrorCode(error);
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const normalizedMessage = message.toLowerCase();

  if (
    context?.isWalletConnect &&
    (context.sessionIncludesArc === false ||
      normalizedMessage.includes("not activated") ||
      normalizedMessage.includes("does not allow") ||
      normalizedMessage.includes("unsupported") ||
      normalizedMessage.includes("unknown chain") ||
      normalizedMessage.includes("unrecognized chain") ||
      normalizedMessage.includes("not added"))
  ) {
    return walletConnectReconnectMessage;
  }

  if (isUserRejectedError(code, message)) {
    return "Network switch was rejected. You are still connected; switch to Arc Testnet when ready.";
  }

  if (
    code === 4902 ||
    normalizedMessage.includes("unknown chain") ||
    normalizedMessage.includes("unrecognized chain") ||
    normalizedMessage.includes("not added")
  ) {
    return "Arc Testnet is not added in this wallet. Try switching again and approve adding Arc Testnet.";
  }

  if (
    normalizedMessage.includes("walletconnect") &&
    (normalizedMessage.includes("session") ||
      normalizedMessage.includes("chain") ||
      normalizedMessage.includes("unsupported"))
  ) {
    return "This WalletConnect session does not allow Arc Testnet. Reconnect the mobile wallet and include Arc Testnet.";
  }

  if (
    normalizedMessage.includes("switchchain") ||
    normalizedMessage.includes("switch chain") ||
    normalizedMessage.includes("unsupported")
  ) {
    return "This wallet did not complete the Arc Testnet switch. Use the button to try again.";
  }

  return message || "Unable to switch to Arc Testnet. Use the button to try again.";
}

export function setArcNetworkSwitchError(
  error: unknown,
  context?: ArcNetworkSwitchErrorContext
) {
  const requiresReconnect =
    Boolean(context?.isWalletConnect) &&
    !isUserRejectedError(
      getNestedErrorCode(error),
      error instanceof Error ? error.message : typeof error === "string" ? error : ""
    ) &&
    (context?.sessionIncludesArc === false ||
      formatArcNetworkSwitchError(error, context) ===
        walletConnectReconnectMessage);

  setSwitchState({
    status: requiresReconnect ? "reconnect_required" : "error",
    message: formatArcNetworkSwitchError(error, context),
  });
}
