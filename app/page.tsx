export default function Home() {
  return (
    <main className="min-h-screen bg-[#05060A] px-6 py-10 text-white">
      <section className="mx-auto flex min-h-[80vh] max-w-5xl flex-col items-center justify-center text-center">
        <div className="mb-6 rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm text-blue-200">
          Built for Arc · Test USDC · Demo Mode
        </div>

        <h1 className="max-w-4xl text-5xl font-bold tracking-tight md:text-7xl">
          Private pDOOH Auctions with Instant USDC Settlement
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-white/60">
          Private auctions for digital advertising screens. Advertisers create
          ads, bid on screen slots, and only the winner is revealed.
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left text-sm text-white/70">
          <p className="font-semibold text-white">⚠️ Demo Mode</p>
          <p className="mt-2">• Arc Testnet</p>
          <p>• Test USDC only</p>
          <p>• Built-in Demo Bot participates in every auction</p>
          <p>• Demo Bot always submits a fixed hidden bid of 0.02 USDC</p>
        </div>
      </section>
    </main>
  );
}