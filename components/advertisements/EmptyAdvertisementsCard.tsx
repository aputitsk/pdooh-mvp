import styles from "@/components/ui/OperationalPanel.module.css";

export default function EmptyAdvertisementsCard() {
  return (
    <div className={`${styles.panel} ${styles.panelDashed} px-8 py-16 text-center`}>
      <div className={`${styles.metric} mx-auto flex h-20 w-20 items-center justify-center text-lg font-bold tracking-widest text-[#CFE8FF]`}>
        AD
      </div>

      <h2 className={`${styles.title} mt-6 text-3xl font-bold`}>
        No advertisements yet
      </h2>

      <p className={`${styles.mutedText} mx-auto mt-4 max-w-md`}>
        Create your first advertisement to participate in pDOOH auctions.
      </p>
    </div>
  );
}
