"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./SuccessToastProvider.module.css";

type SuccessToast = {
  id: number;
  message: string;
};

type SuccessToastListener = (message: string) => void;

const successToastListeners = new Set<SuccessToastListener>();

let nextToastId = 0;

export function showSuccess(message: string) {
  successToastListeners.forEach((listener) => listener(message));
}

export default function SuccessToastProvider() {
  const [toast, setToast] = useState<SuccessToast | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const autoDismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const removeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (autoDismissTimeoutRef.current) {
      clearTimeout(autoDismissTimeoutRef.current);
      autoDismissTimeoutRef.current = null;
    }

    if (removeTimeoutRef.current) {
      clearTimeout(removeTimeoutRef.current);
      removeTimeoutRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(
    (immediate = false) => {
      clearTimers();

      if (immediate) {
        setToast(null);
        setIsExiting(false);
        return;
      }

      setIsExiting(true);
      removeTimeoutRef.current = setTimeout(() => {
        setToast(null);
        setIsExiting(false);
      }, 180);
    },
    [clearTimers]
  );

  useEffect(() => {
    const listener: SuccessToastListener = (message) => {
      clearTimers();
      setIsExiting(false);
      setToast({
        id: nextToastId,
        message,
      });
      nextToastId += 1;

      autoDismissTimeoutRef.current = setTimeout(() => {
        dismissToast();
      }, 3600);
    };

    successToastListeners.add(listener);

    return () => {
      successToastListeners.delete(listener);
      clearTimers();
    };
  }, [clearTimers, dismissToast]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const handlePagePointerDown = () => {
      dismissToast(true);
    };

    document.addEventListener("pointerdown", handlePagePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePagePointerDown, true);
    };
  }, [dismissToast, toast]);

  if (!toast) {
    return null;
  }

  return (
    <div className={styles.toastLayer} role="presentation">
      <button
        key={toast.id}
        type="button"
        className={`${styles.toast} ${isExiting ? styles.toastExiting : ""}`}
        aria-label={`${toast.message}. Dismiss notification`}
        onClick={() => dismissToast(true)}
      >
        <span className={styles.icon} aria-hidden="true">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 8.2 6.7 11 12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.message}>{toast.message}</span>
      </button>
    </div>
  );
}
