import AuctionSettlementHeartbeat from "@/components/auction/AuctionSettlementHeartbeat";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import SuccessToastProvider from "@/components/ui/SuccessToastProvider";
import AppKitWalletProvider from "@/components/wallet/AppKitWalletProvider";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "pDOOH",
  description: "Private digital screen ad auctions with Test USDC settlement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-[#05060A] text-white"
        suppressHydrationWarning
      >
        <AppKitWalletProvider>
          <div className="app-shell">
            <Navbar />
            <AuctionSettlementHeartbeat />
            {children}
            <Footer />
            <SuccessToastProvider />
          </div>
        </AppKitWalletProvider>
      </body>
    </html>
  );
}
