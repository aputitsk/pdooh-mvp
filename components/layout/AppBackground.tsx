import type { ReactNode } from "react";

import styles from "./AppBackground.module.css";

type AppBackgroundProps = {
  children: ReactNode;
  className?: string;
};

export default function AppBackground({
  children,
  className = "",
}: AppBackgroundProps) {
  return (
    <main className={`${styles.background} min-h-screen text-white ${className}`}>
      <div className={styles.content}>{children}</div>
    </main>
  );
}
