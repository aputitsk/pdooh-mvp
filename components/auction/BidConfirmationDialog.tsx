import MoneyAmount from "@/components/ui/MoneyAmount";
import styles from "@/components/ui/OperationalPanel.module.css";

type BidConfirmationDialogProps = {
  advertisementName: string;
  bidAmount: string;
  businessName: string;
  isSubmitting: boolean;
  locationName: string;
  slotNumber: number;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export default function BidConfirmationDialog({
  advertisementName,
  bidAmount,
  businessName,
  isSubmitting,
  locationName,
  slotNumber,
  onCancel,
  onConfirm,
}: BidConfirmationDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bid-confirm-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/50">
        <p className={styles.eyebrow}>Confirm bid</p>
        <h3
          id="bid-confirm-title"
          className={`${styles.title} mt-2 text-xl font-bold`}
        >
          Place bid for Slot {slotNumber}
        </h3>

        <div className={`${styles.metric} mt-4 p-4`}>
          <p className={styles.valueLabel}>Bid amount</p>
          <p className={`${styles.valueText} mt-2 font-mono text-lg tabular-nums`}>
            <MoneyAmount amount={bidAmount} unit="Test USDC" />
          </p>
        </div>

        <div className={`${styles.metric} mt-3 p-4`}>
          <p className={styles.valueLabel}>Advertisement</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {advertisementName}
          </p>
          <p className="mt-1 text-xs font-medium text-white/45">
            {businessName}
          </p>
        </div>

        <div className={`${styles.metric} mt-3 p-4`}>
          <p className={styles.valueLabel}>Placement</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {locationName}
          </p>
        </div>

        <p className="mt-4 text-sm text-white/55">
          This signs a bid authorization with your email wallet. Funds stay in
          escrow until auction settlement.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className={`${styles.secondaryAction} inline-flex min-h-11 flex-1 items-center justify-center px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-70`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isSubmitting}
            className={`${styles.primaryAction} inline-flex min-h-11 flex-1 items-center justify-center px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-70`}
          >
            {isSubmitting ? "Confirming..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
