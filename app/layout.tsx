import AuctionSettlementHeartbeat from "@/components/auction/AuctionSettlementHeartbeat";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import WalletProviders from "@/components/wallet/WalletProviders";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "pDOOH",
  description: "Private digital screen ad auctions with Test USDC settlement.",
};

const stripBrowserExtensionHydrationMarkersScript = `
(function () {
  var attribute = "bis_skin_checked";
  var selector = "[" + attribute + "]";

  function stripMarkers(root) {
    if (!root) {
      return;
    }

    if (root.nodeType === 1 && root.hasAttribute(attribute)) {
      root.removeAttribute(attribute);
    }

    if (typeof root.querySelectorAll !== "function") {
      return;
    }

    root.querySelectorAll(selector).forEach(function (node) {
      node.removeAttribute(attribute);
    });
  }

  stripMarkers(document);

  if (typeof MutationObserver === "undefined") {
    return;
  }

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === "attributes") {
        stripMarkers(mutation.target);
        return;
      }

      mutation.addedNodes.forEach(stripMarkers);
    });
  });

  observer.observe(document.documentElement, {
    attributeFilter: [attribute],
    attributes: true,
    childList: true,
    subtree: true
  });

  window.addEventListener(
    "load",
    function () {
      window.setTimeout(function () {
        observer.disconnect();
      }, 1000);
    },
    { once: true }
  );
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-[#05060A] text-white"
        suppressHydrationWarning
      >
        <WalletProviders>
          <div className="app-shell">
            <Navbar />
            <AuctionSettlementHeartbeat />
            {children}
            <Footer />
          </div>
        </WalletProviders>
        <script
          id="strip-browser-extension-hydration-markers"
          dangerouslySetInnerHTML={{
            __html: stripBrowserExtensionHydrationMarkersScript,
          }}
        />
      </body>
    </html>
  );
}
