import AuctionSettlementHeartbeat from "@/components/auction/AuctionSettlementHeartbeat";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import type { Metadata } from "next";
import "./globals.css";

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
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-[#05060A] text-white"
        suppressHydrationWarning
      >
        <Navbar />
        <AuctionSettlementHeartbeat />
        {children}
        <Footer />
      </body>
    </html>
  );
}
