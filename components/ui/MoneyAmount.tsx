import type { ReactNode } from "react";

import styles from "@/components/ui/OperationalPanel.module.css";

type MoneyAmountProps = {
  amount: ReactNode;
  unit?: ReactNode;
  className?: string;
  unitClassName?: string;
};

export default function MoneyAmount({
  amount,
  unit,
  className = "",
  unitClassName = "",
}: MoneyAmountProps) {
  return (
    <span className={className}>
      <span className={styles.moneyValue}>{amount}</span>
      {unit ? (
        <>
          {" "}
          <span className={unitClassName}>{unit}</span>
        </>
      ) : null}
    </span>
  );
}
