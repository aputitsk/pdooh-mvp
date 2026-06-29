import AppBackground from "@/components/layout/AppBackground";
import TreasuryBalanceWidget from "@/components/home/TreasuryBalanceWidget";

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
        <div className="mb-6 w-full max-w-[60rem] md:absolute md:right-0 md:top-0 md:mb-0 md:w-[220px]">
          <TreasuryBalanceWidget />
        </div>

        <div className="text-center">
          <div className="mb-5 rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm text-blue-200">
            Built for Arc · Test USDC · Demo Mode
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            pDOOH Auction Demo
          </h1>
        </div>

        <div className="mt-8 w-full max-w-[60rem] space-y-5 text-left text-base leading-8 text-white/65">
          <p>
            This application demonstrates a simplified pDOOH advertising auction
            running on Arc Testnet. It showcases the auction workflow, escrow
            deposits, automated settlement, and wallet integration rather than
            a complete production advertising platform.
          </p>

          <p>
            The application uses{" "}
            <span className="font-semibold text-white">Test USDC</span>{" "}
            as the payment currency for advertising placements and for network
            transaction fees on Arc Testnet.
          </p>

          <p>
            To demonstrate competitive bidding, every auction includes a
            built-in <span className="font-semibold text-white">Demo Bot</span>{" "}
            with a fixed bid of{" "}
            <span className="font-semibold text-white">0.02 Test USDC</span>.
          </p>
        </div>

        <div className="mt-7 w-full max-w-[60rem] rounded-2xl border border-neutral-800 bg-neutral-900/40 px-6 py-4 text-left text-sm leading-6 text-neutral-400">
          <span className="font-semibold text-white">
            Digital Out-of-Home (DOOH)
          </span>{" "}
          is digital advertising displayed on public screens such as billboards,
          shopping malls, airports, and transit stations.
        </div>

        <div className="mt-7 w-full max-w-6xl">
          <h2 className="text-lg font-semibold text-white">
            Why Blockchain?
          </h2>

          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {blockchainAdvantages.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 text-left"
              >
                <h3 className="text-base font-semibold leading-6 text-white">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-neutral-400">
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
