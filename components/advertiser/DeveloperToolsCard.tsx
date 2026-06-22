import { resetStoredAdvertiser } from "@/lib/advertiser/advertiserStorage";
import { resetStoredAdvertisements } from "@/lib/advertisements/advertisementStorage";
import { resetDemoAuctionStore } from "@/lib/auction";
import { resetWallet } from "@/lib/wallet";

export default function DeveloperToolsCard() {
  function resetDemo() {
    resetWallet();
    resetStoredAdvertiser();
    resetStoredAdvertisements();
    resetDemoAuctionStore();

    window.location.reload();
  }

  return (
    <div className="mt-10 rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
      <p className="text-sm font-medium text-red-400">
        Developer Tools
      </p>

      <p className="mt-2 text-sm text-white/50">
        Reset all demo data and restart onboarding.
      </p>

      <button
        type="button"
        onClick={resetDemo}
        className="mt-5 rounded-full bg-red-500 px-5 py-3 font-semibold text-white transition hover:bg-red-400"
      >
        Reset Demo
      </button>
    </div>
  );
}
