export default function Home() {
  return (
    <main className="min-h-screen bg-[#05060A] px-6 py-10 text-white">
      <section className="mx-auto flex min-h-[80vh] max-w-5xl flex-col items-center justify-center text-center">
        <div className="mb-6 rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm text-blue-200">
          Built for Arc · Test USDC · Demo Mode
        </div>

        <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
          pDOOH Auction Demo
        </h1>

        <div className="mt-8 max-w-3xl space-y-5 text-lg leading-8 text-white/65">
          <p>
            This application demonstrates a simplified pDOOH advertising
            auction running on Arc Testnet. It is designed to showcase the
            auction workflow, escrow deposits, automated settlement, and wallet
            integration rather than a complete production advertising platform.
          </p>

          <p>
            <span className="font-semibold text-white">
              Digital Out-of-Home (DOOH)
            </span>{" "}
            is digital advertising displayed on public screens such as
            billboards, shopping malls, airports, and transit stations.
          </p>

          <p>
            The application uses{" "}
            <span className="font-semibold text-white">Test USDC</span> as the
            payment currency for advertising placements.{" "}
            <span className="font-semibold text-white">Test USDC</span> is also
            used to pay network transaction fees on Arc Testnet, allowing the
            complete auction and settlement workflow to be demonstrated without
            using real funds.
          </p>

          <p>
            To demonstrate competitive bidding, every auction includes a
            built-in{" "}
            <span className="font-semibold text-white">Demo Bot</span> with a
            fixed, unchanging bid of{" "}
            <span className="font-semibold text-white">0.02 Test USDC</span>.
          </p>
        </div>
      </section>
    </main>
  );
}