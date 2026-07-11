export default function DemoModeCard() {
  return (
    <div className="mb-6 rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-400">
            Demo Mode
          </p>

          <h2 className="mt-1 text-2xl font-bold text-[#CFE8FF]">
            Auction Rules
          </h2>
        </div>

        <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-300">
          Active
        </span>
      </div>

      <div className="mt-6 space-y-3 text-sm text-neutral-400">
        <p>
          Wait until the slot auction opens. Each auction cycle gives
          advertisers 1 minute to place bids.
        </p>

        <p>
          Select one of your advertisements, enter your bid amount, and confirm
          it with the bid button.
        </p>

        <p>
          After the auction closes, each available slot plays the winning
          advertisement for 10 seconds.
        </p>

        <p>
          To demonstrate competitive bidding, every auction includes a built-in
          Demo Bot with a fixed, unchanging bid of{" "}
          <span className="font-mono tabular-nums">0.02 Test USDC</span>.
        </p>
      </div>
    </div>
  );
}
