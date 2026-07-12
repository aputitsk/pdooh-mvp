import AppBackground from "@/components/layout/AppBackground";
import styles from "@/components/ui/OperationalPanel.module.css";

const blockchainAdvantages = [
  {
    title: "Immutable History",
    text: "Escrow deposits, settlements, fees, and advertising payments are recorded on-chain.",
  },
  {
    title: "Automated & Deterministic Settlement",
    text: "Smart contracts execute auction settlements automatically according to predefined rules, ensuring predictable and verifiable execution.",
  },
  {
    title: "Revenue Distribution",
    text: "Platform fees and publisher revenue can be distributed through verifiable smart contracts.",
  },
  {
    title: "Proof of Play",
    text: "The architecture can support on-chain proof-of-play verification for displayed ads.",
  },
];

export default function Home() {
  return (
    <AppBackground className="px-6 py-8">
      <section className="relative mx-auto flex min-h-[82vh] max-w-6xl flex-col items-center justify-center">
        <div className="w-full text-center">
          <div className={`${styles.statusPill} ${styles.statusPillInfo} mx-auto inline-flex px-4 py-2 text-sm font-semibold`}>
            Built for Arc <span className="mx-2 text-white/25">/</span> Test
            USDC <span className="mx-2 text-white/25">/</span> Demo Mode
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight md:text-5xl">
            pDOOH Auction Demo
          </h1>

          <div className={`${styles.panel} mx-auto mt-6 max-w-[60rem] px-5 py-4 text-left`}>
            <p className={styles.valueLabel}>Digital Out-of-Home</p>
            <p className={`${styles.mutedText} mt-2 text-sm leading-6`}>
              <span className={styles.valueText}>
                Digital Out-of-Home (DOOH)
              </span>{" "}
              is digital advertising displayed on public screens such as
              billboards, shopping malls, airports, and transit stations.
            </p>
          </div>
        </div>

        <div className={`${styles.panel} mt-6 w-full max-w-[60rem] px-5 py-5 text-left`}>
          <p className={`${styles.mutedText} text-base leading-8`}>
            This application demonstrates a simplified pDOOH advertising auction
            running on{" "}
            <span className="font-semibold text-white">Arc Testnet</span>. It
            showcases the auction workflow, escrow deposits, automated
            settlement, and wallet integration rather than a complete production
            advertising platform. The application uses{" "}
            <span className="font-semibold text-white">Test USDC</span> as the
            payment currency for advertising placements and for network
            transaction fees. To demonstrate competitive bidding, every auction
            includes a built-in{" "}
            <span className="font-semibold text-white">Demo Bot</span> with a
            fixed bid of{" "}
            <span className="font-mono font-semibold tabular-nums text-white">
              0.02 Test USDC
            </span>.
          </p>
        </div>

        <div className="mt-7 w-full max-w-6xl">
          <h2 className={`${styles.valueLabel} text-left`}>
            Why Blockchain?
          </h2>

          <div className="home-landscape-card-grid mt-4 grid gap-5 md:grid-cols-2">
            {blockchainAdvantages.map((item) => (
              <div
                key={item.title}
                className={`${styles.panel} p-5 text-left`}
              >
                <h3 className={`${styles.title} text-base font-semibold leading-6`}>
                  {item.title}
                </h3>

                <p className={`${styles.mutedText} mt-3 text-sm leading-6`}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppBackground>
  );
}
