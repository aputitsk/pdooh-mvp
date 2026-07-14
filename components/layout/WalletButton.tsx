"use client";

import {
  useLoginWithEmail,
  useLogout,
  usePrivy,
} from "@privy-io/react-auth";
import { useAppKit, useDisconnect } from "@reown/appkit/react";
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import CopyButton from "@/components/ui/CopyButton";
import operationalStyles from "@/components/ui/OperationalPanel.module.css";
import ArcNetworkSwitchButton from "@/components/wallet/ArcNetworkSwitchButton";
import { isArcAppKitConfigured } from "@/lib/arc/arcAppKitConfig";
import { isArcPrivyConfigured } from "@/lib/arc/arcPrivyConfig";
import {
  clearArcNetworkConnectionAttempt,
  markArcNetworkConnectionAttempt,
} from "@/lib/wallet/arcNetworkSwitchState";
import {
  clearWalletFlowNotice,
  getWalletFlowNotice,
  subscribeToWalletFlowNotice,
} from "@/lib/wallet/walletFlowNoticeState";
import {
  formatWalletAddress,
  getWalletState,
  logOutWallet,
  subscribeToWalletChanges,
  type WalletState,
} from "@/lib/wallet";

const disconnectedWallet: WalletState = {
  status: "disconnected",
  connected: false,
  address: null,
  chainId: null,
  source: null,
};

const OTP_CODE_LENGTH = 6;

let cachedWallet = disconnectedWallet;

type WalletMenuIconProps = {
  className?: string;
};

function ChevronDownIcon({ className }: WalletMenuIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="m5.5 7.5 4.5 4.5 4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DisconnectIcon({ className }: WalletMenuIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M10 3.75v6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M6.25 6.45a5.25 5.25 0 1 0 7.5 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getWalletSnapshot() {
  const nextWallet = getWalletState();

  if (
    cachedWallet.connected === nextWallet.connected &&
    cachedWallet.address === nextWallet.address &&
    cachedWallet.status === nextWallet.status &&
    cachedWallet.chainId === nextWallet.chainId &&
    cachedWallet.source === nextWallet.source
  ) {
    return cachedWallet;
  }

  cachedWallet = nextWallet;
  return cachedWallet;
}

function getServerWalletSnapshot() {
  return disconnectedWallet;
}

function getServerWalletFlowNotice() {
  return null;
}

function createEmptyOtpCode() {
  return Array.from({ length: OTP_CODE_LENGTH }, () => "");
}

function WalletUnavailableButton() {
  return (
    <button
      type="button"
      disabled
      title="Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID or NEXT_PUBLIC_PRIVY_APP_ID to enable login."
      className={`${operationalStyles.navPrimaryAction} inline-flex min-h-10 items-center justify-center px-4 py-2 text-sm font-semibold`}
    >
      Login
    </button>
  );
}

function ConnectedWalletMenu({
  connectionLabel,
  disconnectError,
  isDisconnecting,
  wallet,
  onDisconnect,
}: {
  connectionLabel: string;
  disconnectError?: string | null;
  isDisconnecting?: boolean;
  wallet: WalletState;
  onDisconnect: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCopyNoticeVisible, setIsCopyNoticeVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const copyNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    return () => {
      if (copyNoticeTimeoutRef.current) {
        clearTimeout(copyNoticeTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    setIsMenuOpen(false);
    setIsCopyNoticeVisible(true);

    if (copyNoticeTimeoutRef.current) {
      clearTimeout(copyNoticeTimeoutRef.current);
    }

    copyNoticeTimeoutRef.current = setTimeout(() => {
      setIsCopyNoticeVisible(false);
    }, 1800);
  }

  if (!wallet.address) {
    return null;
  }

  return (
    <div ref={menuRef} className="relative max-w-full">
      <button
        type="button"
        onClick={() => setIsMenuOpen((current) => !current)}
        className={`${operationalStyles.navSecondaryAction} flex max-w-full items-center gap-2 px-4 py-2 text-sm font-medium`}
      >
        <span className="min-w-0 truncate font-mono">
          {formatWalletAddress(wallet.address)}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 text-[#CFE8FF]/55 transition-transform ${
            isMenuOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isMenuOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/40">
          <div className="border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm font-semibold text-zinc-100">
                {formatWalletAddress(wallet.address)}
              </span>
              <CopyButton
                ariaLabel="Copy wallet address"
                title="Copy"
                onClick={() =>
                  void (wallet.address && handleCopyAddress(wallet.address))
                }
                className="rounded-full p-1.5 text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
                iconClassName="h-4 w-4"
              />
            </div>
            <p className="mt-1 text-xs font-semibold text-zinc-500">
              {connectionLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onDisconnect();
              setIsMenuOpen(false);
            }}
            disabled={isDisconnecting}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-400 transition hover:bg-zinc-900 disabled:cursor-wait disabled:opacity-70"
          >
            <DisconnectIcon className="h-4 w-4" />
            <span>{isDisconnecting ? "Disconnecting..." : "Logout"}</span>
          </button>
        </div>
      ) : null}

      {isCopyNoticeVisible ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute right-0 z-50 mt-2 whitespace-nowrap rounded-full border border-emerald-300/20 bg-zinc-950 px-3 py-2 text-xs font-semibold text-emerald-200 shadow-xl shadow-black/40"
        >
          Address copied
        </div>
      ) : null}

      {disconnectError ? (
        <div
          role="status"
          className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-red-500/30 bg-zinc-950 px-4 py-3 text-sm font-medium text-red-300 shadow-xl shadow-black/40"
        >
          {disconnectError}
        </div>
      ) : null}
    </div>
  );
}

function WalletFlowNotice() {
  const walletFlowNotice = useSyncExternalStore(
    subscribeToWalletFlowNotice,
    getWalletFlowNotice,
    getServerWalletFlowNotice
  );

  useEffect(() => {
    if (!walletFlowNotice) {
      return;
    }

    const timeoutId = setTimeout(() => {
      clearWalletFlowNotice();
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [walletFlowNotice]);

  if (!walletFlowNotice) {
    return null;
  }

  return (
    <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-yellow-400/25 bg-zinc-950 px-4 py-3 text-sm font-medium text-yellow-200 shadow-xl shadow-black/40">
      {walletFlowNotice}
    </div>
  );
}

function WalletLoginOption({
  onError,
  onStarted,
}: {
  onError: (message: string) => void;
  onStarted: () => void;
}) {
  const { open } = useAppKit();

  function handleWalletLoginClick() {
    onError("");
    clearWalletFlowNotice();
    markArcNetworkConnectionAttempt();

    try {
      const openPromise = open({ view: "Connect" });
      onStarted();

      void Promise.resolve(openPromise).catch((error: unknown) => {
        clearArcNetworkConnectionAttempt();
        onError(
          error instanceof Error ? error.message : "Login failed"
        );
      });
    } catch (error: unknown) {
      clearArcNetworkConnectionAttempt();
      onError(error instanceof Error ? error.message : "Login failed");
    }
  }

  return (
    <button
      type="button"
      onClick={handleWalletLoginClick}
      className={`${operationalStyles.navSecondaryAction} flex min-h-11 w-full items-center justify-between px-4 py-2 text-sm font-semibold`}
    >
      <span>Wallet</span>
      <span className="text-xs font-medium text-[#CFE8FF]/55">
        MetaMask, Rabby, OKX
      </span>
    </button>
  );
}

function AppKitOnlyLoginButton() {
  const [connectError, setConnectError] = useState<string | null>(null);
  const { open } = useAppKit();

  function handleLoginClick() {
    setConnectError(null);
    clearWalletFlowNotice();
    markArcNetworkConnectionAttempt();

    void Promise.resolve()
      .then(() => open({ view: "Connect" }))
      .catch((error: unknown) => {
        clearArcNetworkConnectionAttempt();
        setConnectError(
          error instanceof Error ? error.message : "Login failed"
        );
      });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleLoginClick}
        className={`${operationalStyles.navPrimaryAction} inline-flex min-h-10 items-center justify-center px-4 py-2 text-sm font-semibold`}
      >
        Login
      </button>

      {connectError ? (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-red-500/30 bg-zinc-950 px-4 py-3 text-sm font-medium text-red-300 shadow-xl shadow-black/40">
          {connectError}
        </div>
      ) : null}
    </div>
  );
}

function LoginButton({
  hasAppKit,
  hasPrivy,
}: {
  hasAppKit: boolean;
  hasPrivy: boolean;
}) {
  const [connectError, setConnectError] = useState<string | null>(null);
  const { authenticated, ready } = usePrivy();
  const { logout } = useLogout();
  const { loginWithCode, sendCode, state } = useLoginWithEmail();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeLoginMethod, setActiveLoginMethod] = useState<
    "choices" | "email"
  >("choices");
  const [email, setEmail] = useState("");
  const [codeDigits, setCodeDigits] = useState(createEmptyOtpCode);
  const [isEmailCodeStepOpen, setIsEmailCodeStepOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [hasWalletLoadTimedOut, setHasWalletLoadTimedOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const isSendingCode = state.status === "sending-code";
  const isSubmittingCode = state.status === "submitting-code";
  const isBusy = isSendingCode || isSubmittingCode;
  const code = codeDigits.join("");
  const flowError =
    localError ??
    (state.status === "error" && isEmailCodeStepOpen
      ? state.error?.message
      : null);
  const isAwaitingCode = isEmailCodeStepOpen || isSubmittingCode;

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setHasWalletLoadTimedOut(true);
    }, 18000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [authenticated]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
        setActiveLoginMethod("choices");
        setIsEmailCodeStepOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isEmailCodeStepOpen) {
      return;
    }

    codeInputRefs.current[0]?.focus();
  }, [isEmailCodeStepOpen]);

  function openLoginMenu() {
    setConnectError(null);
    setLocalError(null);
    clearWalletFlowNotice();
    setActiveLoginMethod("choices");
    setIsEmailCodeStepOpen(false);
    setIsMenuOpen((current) => !current);
  }

  function returnToEmailEntry() {
    setCodeDigits(createEmptyOtpCode());
    setLocalError(null);
    setIsEmailCodeStepOpen(false);
  }

  async function handleResetPrivyLogin() {
    setLocalError(null);
    await logout()
      .then(() => {
        logOutWallet("privy");
        setHasWalletLoadTimedOut(false);
        setCodeDigits(createEmptyOtpCode());
        setIsEmailCodeStepOpen(false);
        setIsMenuOpen(false);
        setActiveLoginMethod("choices");
      })
      .catch((error: unknown) => {
        setLocalError(
          error instanceof Error ? error.message : "Email logout failed."
        );
      });
  }

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setLocalError("Enter an email address.");
      return;
    }

    setLocalError(null);
    setCodeDigits(createEmptyOtpCode());
    setHasWalletLoadTimedOut(false);

    try {
      await sendCode({ email: trimmedEmail });
      setIsEmailCodeStepOpen(true);
    } catch (error: unknown) {
      setLocalError(
        error instanceof Error ? error.message : "Unable to send email code."
      );
      return;
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCode = code.trim();

    if (trimmedCode.length !== OTP_CODE_LENGTH) {
      setLocalError("Enter the verification code.");
      return;
    }

    setLocalError(null);
    setHasWalletLoadTimedOut(false);
    await loginWithCode({ code: trimmedCode })
      .then(() => {
        setCodeDigits(createEmptyOtpCode());
        setIsEmailCodeStepOpen(false);
        setIsMenuOpen(false);
        setActiveLoginMethod("choices");
      })
      .catch((error: unknown) => {
        setLocalError(
          error instanceof Error ? error.message : "Invalid or expired code."
        );
      });
  }

  function handleOtpDigitChange(index: number, value: string) {
    const digits = value.replace(/\D/g, "").slice(0, OTP_CODE_LENGTH - index);

    setCodeDigits((currentDigits) => {
      const nextDigits = [...currentDigits];

      if (!digits) {
        nextDigits[index] = "";
        return nextDigits;
      }

      digits.split("").forEach((digit, offset) => {
        nextDigits[index + offset] = digit;
      });

      return nextDigits;
    });

    if (digits) {
      const nextIndex = Math.min(index + digits.length, OTP_CODE_LENGTH - 1);
      codeInputRefs.current[nextIndex]?.focus();
      codeInputRefs.current[nextIndex]?.select();
    }
  }

  function handleOtpDigitKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Backspace" && !codeDigits[index] && index > 0) {
      event.preventDefault();
      setCodeDigits((currentDigits) => {
        const nextDigits = [...currentDigits];
        nextDigits[index - 1] = "";
        return nextDigits;
      });
      codeInputRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      codeInputRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowRight" && index < OTP_CODE_LENGTH - 1) {
      event.preventDefault();
      codeInputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpPaste(
    index: number,
    event: ClipboardEvent<HTMLInputElement>
  ) {
    const pastedDigits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "");

    if (!pastedDigits) {
      return;
    }

    event.preventDefault();
    handleOtpDigitChange(index, pastedDigits);
  }

  const loginButtonText = !ready
    ? "Login loading..."
    : authenticated
      ? hasWalletLoadTimedOut
        ? "Reset email login"
        : "Email wallet loading..."
      : "Login";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (authenticated) {
            void handleResetPrivyLogin();
            return;
          }

          openLoginMenu();
        }}
        disabled={!ready || (authenticated && !hasWalletLoadTimedOut)}
        className={`${operationalStyles.navPrimaryAction} inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {loginButtonText}
      </button>

      {isMenuOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl shadow-black/40">
          {activeLoginMethod === "choices" ? (
            <div className="space-y-2">
              {hasAppKit ? (
                <WalletLoginOption
                  onStarted={() => setIsMenuOpen(false)}
                  onError={(message) => setConnectError(message || null)}
                />
              ) : null}
              {hasPrivy ? (
                <button
                  type="button"
                  onClick={() => {
                    setConnectError(null);
                    setLocalError(null);
                    clearWalletFlowNotice();
                    setCodeDigits(createEmptyOtpCode());
                    setIsEmailCodeStepOpen(false);
                    setActiveLoginMethod("email");
                  }}
                  disabled={!ready}
                  className={`${operationalStyles.navSecondaryAction} flex min-h-11 w-full items-center justify-between px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span>Email</span>
                  <span className="text-xs font-medium text-[#CFE8FF]/55">
                    OTP code
                  </span>
                </button>
              ) : null}
            </div>
          ) : !isAwaitingCode ? (
            <form onSubmit={(event) => void handleSendCode(event)}>
              <label className="block text-xs font-semibold text-zinc-400">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  disabled={isBusy}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/50"
                />
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setLocalError(null);
                    setIsEmailCodeStepOpen(false);
                    setActiveLoginMethod("choices");
                  }}
                  className={`${operationalStyles.navSecondaryAction} inline-flex min-h-10 flex-1 items-center justify-center px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className={`${operationalStyles.navPrimaryAction} inline-flex min-h-10 flex-1 items-center justify-center px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-70`}
                >
                  {isSendingCode ? "Sending..." : "Send code"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={(event) => void handleVerifyCode(event)}>
              <fieldset disabled={isBusy}>
                <legend className="block text-xs font-semibold text-zinc-400">
                  Verification code
                </legend>
                <div className="mt-2 grid grid-cols-6 gap-2">
                  {codeDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        codeInputRefs.current[index] = element;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={OTP_CODE_LENGTH}
                      value={digit}
                      onChange={(event) =>
                        handleOtpDigitChange(index, event.target.value)
                      }
                      onKeyDown={(event) =>
                        handleOtpDigitKeyDown(index, event)
                      }
                      onPaste={(event) => handleOtpPaste(index, event)}
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      aria-label={`Verification code digit ${index + 1}`}
                      className="aspect-square w-full rounded-xl border border-zinc-800 bg-zinc-900 text-center font-mono text-lg font-semibold tabular-nums text-zinc-100 outline-none transition focus:border-cyan-300/50 disabled:cursor-wait disabled:opacity-70"
                    />
                  ))}
                </div>
              </fieldset>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={returnToEmailEntry}
                  className={`${operationalStyles.navSecondaryAction} inline-flex min-h-10 flex-1 items-center justify-center px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className={`${operationalStyles.navPrimaryAction} inline-flex min-h-10 flex-1 items-center justify-center px-3 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-70`}
                >
                  {isSubmittingCode ? "Verifying..." : "Verify"}
                </button>
              </div>
            </form>
          )}

          {flowError ? (
            <p className="mt-3 text-sm font-medium text-red-300">
              {flowError}
            </p>
          ) : null}
          {connectError ? (
            <p className="mt-3 text-sm font-medium text-red-300">
              {connectError}
            </p>
          ) : null}
        </div>
      ) : null}

      {!isMenuOpen && connectError ? (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-red-500/30 bg-zinc-950 px-4 py-3 text-sm font-medium text-red-300 shadow-xl shadow-black/40">
          {connectError}
        </div>
      ) : null}
    </div>
  );
}

function AppKitConnectedWalletControls({ wallet }: { wallet: WalletState }) {
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const { disconnect } = useDisconnect();

  function handleDisconnect() {
    setDisconnectError(null);

    void disconnect({ namespace: "eip155" })
      .catch((error: unknown) => {
        setDisconnectError(
          error instanceof Error ? error.message : "Wallet disconnect failed."
        );
      })
      .finally(() => {
        logOutWallet("appkit");
      });
  }

  return (
    <div className="flex max-w-[52vw] flex-col items-end gap-2 sm:max-w-none sm:flex-row sm:items-center">
      <ArcNetworkSwitchButton variant="compact" />
      <ConnectedWalletMenu
        connectionLabel="External Wallet"
        disconnectError={disconnectError}
        wallet={wallet}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
}

function PrivyConnectedWalletControls({ wallet }: { wallet: WalletState }) {
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { logout } = useLogout();

  function handleDisconnect() {
    setDisconnectError(null);
    setIsDisconnecting(true);

    void logout()
      .then(() => {
        logOutWallet("privy");
      })
      .catch((error: unknown) => {
        setDisconnectError(
          error instanceof Error ? error.message : "Email logout failed."
        );
      })
      .finally(() => {
        setIsDisconnecting(false);
      });
  }

  return (
    <div className="flex max-w-[52vw] flex-col items-end gap-2 sm:max-w-none sm:flex-row sm:items-center">
      <ArcNetworkSwitchButton variant="compact" />
      <ConnectedWalletMenu
        connectionLabel="Email Wallet"
        disconnectError={disconnectError}
        isDisconnecting={isDisconnecting}
        wallet={wallet}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
}

function DisconnectedWalletActions() {
  const hasAppKit = isArcAppKitConfigured();
  const hasPrivy = isArcPrivyConfigured();

  if (!hasAppKit && !hasPrivy) {
    return <WalletUnavailableButton />;
  }

  return (
    <div className="relative flex max-w-[70vw] flex-wrap items-center justify-end gap-2 sm:max-w-none">
      {hasPrivy ? (
        <LoginButton hasAppKit={hasAppKit} hasPrivy={hasPrivy} />
      ) : (
        <AppKitOnlyLoginButton />
      )}
      <WalletFlowNotice />
    </div>
  );
}

export default function WalletButton() {
  const wallet = useSyncExternalStore(
    subscribeToWalletChanges,
    getWalletSnapshot,
    getServerWalletSnapshot
  );

  if (wallet.connected && wallet.address) {
    if (wallet.source === "privy" && isArcPrivyConfigured()) {
      return <PrivyConnectedWalletControls wallet={wallet} />;
    }

    if (wallet.source === "appkit" && isArcAppKitConfigured()) {
      return <AppKitConnectedWalletControls wallet={wallet} />;
    }
  }

  return <DisconnectedWalletActions />;
}
