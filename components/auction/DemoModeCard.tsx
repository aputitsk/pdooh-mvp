export default function DemoModeCard() {
  return (
    <div className="mb-6 rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-400">
            Demo Mode
          </p>

          <h2 className="mt-1 text-2xl font-bold">
            Private Auction Rules
          </h2>
        </div>

        <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-300">
          Active
        </span>
      </div>

      <div className="mt-6 space-y-3 text-sm text-neutral-400">
        <p>• All bids are completely hidden.</p>

        <p>• Only the winning advertisement is revealed.</p>

        <p>• Highest hidden bid wins.</p>

        <p>• If bids are equal, the earliest bid wins.</p>

        <p>• Demo Bot always participates in every auction.</p>

        <p>• Demo Bot always places a hidden bid of 0.02 Test USDC.</p>

        <p>
          • Demo Bot participates publicly, but its bid is never shown during or
          after the auction.
        </p>
      </div>
    </div>
  );
}