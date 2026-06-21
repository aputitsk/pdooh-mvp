"use client";

import { useEffect, useState } from "react";

import AuctionArea from "@/components/auction/AuctionArea";
import LiveScreen from "@/components/auction/LiveScreen";
import { useDemoAuctionStore } from "@/lib/auction";

type Advertisement = {
  name: string;
  company: string;
};

type SlotState = {
  selectedAdvertisement: string;
  bid: string;
};

const slots = ["Slot 1", "Slot 2", "Slot 3"];

const auctionOpenSeconds = 40;
const selectingSeconds = 2;
const playbackSecondsPerSlot = 10;

const demoBotAdvertisement: Advertisement = {
  company: "Demo Bot",
  name: "Demo Advertisement",
};

export default function ScreenPage() {
  const auction = useDemoAuctionStore();

  const [isLoaded, setIsLoaded] = useState(false);
  const [, forceClockRender] = useState(0);

  const [ads, setAds] = useState<Advertisement[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [demoTreasury, setDemoTreasury] = useState(0);

  const [activeCycleId, setActiveCycleId] = useState(0);

  const [winners, setWinners] = useState<Advertisement[]>(
    slots.map(() => demoBotAdvertisement)
  );

  const [winnerBidAmounts, setWinnerBidAmounts] = useState<number[]>(
    slots.map(() => 0)
  );

  const [paidSlots, setPaidSlots] = useState<boolean[]>(
    slots.map(() => false)
  );

  const [slotStates, setSlotStates] = useState<SlotState[]>(
    slots.map(() => ({
      selectedAdvertisement: "",
      bid: "",
    }))
  );

  const [submittedBids, setSubmittedBids] = useState<boolean[]>(
    slots.map(() => false)
  );

  const phase = auction.clock.phase;
  const secondsRemaining = auction.clock.secondsRemaining;
  const currentSlotIndex = auction.clock.currentSlotIndex;
  const elapsedInCycle = auction.clock.elapsedInCycle;

  useEffect(() => {
    const savedAds = localStorage.getItem("pdooh-ads");
    const savedBalance = localStorage.getItem("pdooh-balance");
    const savedTreasury = localStorage.getItem("pdooh-demo-treasury");
    const savedCycleId = localStorage.getItem("pdooh-auction-cycle-id");
    const savedSlotStates = localStorage.getItem("pdooh-auction-slot-states");
    const savedSubmittedBids = localStorage.getItem(
      "pdooh-auction-submitted-bids"
    );
    const savedPaidSlots = localStorage.getItem("pdooh-auction-paid-slots");

    if (savedAds) {
      setAds(JSON.parse(savedAds));
    }

    setWalletBalance(Number(savedBalance || "0"));
    setDemoTreasury(Number(savedTreasury || "0"));
    setActiveCycleId(auction.clock.cycleId);

    if (savedCycleId === String(auction.clock.cycleId)) {
      if (savedSlotStates) {
        setSlotStates(JSON.parse(savedSlotStates));
      }

      if (savedSubmittedBids) {
        setSubmittedBids(JSON.parse(savedSubmittedBids));
      }

      if (savedPaidSlots) {
        setPaidSlots(JSON.parse(savedPaidSlots));
      }
    } else {
      localStorage.setItem(
        "pdooh-auction-cycle-id",
        String(auction.clock.cycleId)
      );
      resetAuctionInputs();
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      forceClockRender((value) => value + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (auction.clock.cycleId !== activeCycleId) {
      processAllUnpaidSlots();
      setActiveCycleId(auction.clock.cycleId);

      localStorage.setItem(
        "pdooh-auction-cycle-id",
        String(auction.clock.cycleId)
      );

      resetAuctionInputs();
    }
  }, [isLoaded, auction.clock.cycleId, activeCycleId]);

  useEffect(() => {
    if (!isLoaded) return;

    const syncInterval = setInterval(() => {
      const savedAds = localStorage.getItem("pdooh-ads");
      const savedBalance = localStorage.getItem("pdooh-balance");

      if (savedAds) {
        const parsedAds: Advertisement[] = JSON.parse(savedAds);

        setAds((currentAds) => {
          if (JSON.stringify(currentAds) === JSON.stringify(parsedAds)) {
            return currentAds;
          }

          return parsedAds;
        });
      }

      if (savedBalance !== null) {
        const parsedBalance = Number(savedBalance);

        setWalletBalance((currentBalance) => {
          if (currentBalance === parsedBalance) {
            return currentBalance;
          }

          return parsedBalance;
        });
      }
    }, 500);

    return () => clearInterval(syncInterval);
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    localStorage.setItem(
      "pdooh-auction-slot-states",
      JSON.stringify(slotStates)
    );
  }, [isLoaded, slotStates]);

  useEffect(() => {
    if (!isLoaded) return;

    localStorage.setItem(
      "pdooh-auction-submitted-bids",
      JSON.stringify(submittedBids)
    );
  }, [isLoaded, submittedBids]);

  useEffect(() => {
    if (!isLoaded) return;

    localStorage.setItem("pdooh-auction-paid-slots", JSON.stringify(paidSlots));
  }, [isLoaded, paidSlots]);

  useEffect(() => {
    if (!isLoaded) return;

    selectWinners();
  }, [isLoaded, slotStates, submittedBids, ads]);

  useEffect(() => {
    if (!isLoaded || phase !== "live") return;

    slots.forEach((_, index) => {
      const slotEndTime =
        auctionOpenSeconds +
        selectingSeconds +
        playbackSecondsPerSlot * (index + 1);

      if (elapsedInCycle >= slotEndTime) {
        processSlotPayment(index);
      }
    });
  }, [isLoaded, phase, elapsedInCycle, winners, winnerBidAmounts, paidSlots]);

  function resetAuctionInputs() {
    const emptySlotStates = slots.map(() => ({
      selectedAdvertisement: "",
      bid: "",
    }));

    const emptyBooleans = slots.map(() => false);

    setSlotStates(emptySlotStates);
    setSubmittedBids(emptyBooleans);
    setWinnerBidAmounts(slots.map(() => 0));
    setPaidSlots(emptyBooleans);
    setWinners(slots.map(() => demoBotAdvertisement));

    localStorage.setItem(
      "pdooh-auction-slot-states",
      JSON.stringify(emptySlotStates)
    );

    localStorage.setItem(
      "pdooh-auction-submitted-bids",
      JSON.stringify(emptyBooleans)
    );

    localStorage.setItem(
      "pdooh-auction-paid-slots",
      JSON.stringify(emptyBooleans)
    );
  }

  function updateSlot(index: number, nextState: Partial<SlotState>) {
    if (phase !== "open") return;
    if (submittedBids[index]) return;

    setSlotStates((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...nextState } : slot
      )
    );
  }

  function placeBid(index: number) {
    const slot = slotStates[index];
    const bidAmount = Number(slot.bid);

    if (phase !== "open") return;
    if (submittedBids[index]) return;
    if (!slot.selectedAdvertisement) return;
    if (!bidAmount || bidAmount <= 0) return;
    if (bidAmount > walletBalance) return;

    setSubmittedBids((current) =>
      current.map((isSubmitted, slotIndex) =>
        slotIndex === index ? true : isSubmitted
      )
    );
  }

  function selectWinners() {
    const demoBotBid = 0.02;

    const nextWinners = slotStates.map((slot, index) => {
      const userBid = Number(slot.bid);

      const ad = ads.find((item) => item.name === slot.selectedAdvertisement);

      if (!submittedBids[index] || !ad || !userBid || userBid <= demoBotBid) {
        return demoBotAdvertisement;
      }

      return ad;
    });

    const nextWinnerBidAmounts = slotStates.map((slot, index) => {
      const userBid = Number(slot.bid);
      const winner = nextWinners[index];

      if (winner.company === demoBotAdvertisement.company) {
        return 0;
      }

      return userBid;
    });

    setWinners(nextWinners);
    setWinnerBidAmounts(nextWinnerBidAmounts);
  }

  function processSlotPayment(slotIndex: number) {
    if (paidSlots[slotIndex]) return;

    const winner = winners[slotIndex];
    const paymentAmount = winnerBidAmounts[slotIndex];

    setPaidSlots((current) =>
      current.map((isPaid, index) => (index === slotIndex ? true : isPaid))
    );

    if (winner.company === demoBotAdvertisement.company) return;
    if (!paymentAmount || paymentAmount <= 0) return;

    setWalletBalance((currentBalance) => {
      const nextBalance = Math.max(currentBalance - paymentAmount, 0);
      localStorage.setItem("pdooh-balance", String(nextBalance));
      return nextBalance;
    });

    setDemoTreasury((currentTreasury) => {
      const nextTreasury = currentTreasury + paymentAmount;
      localStorage.setItem("pdooh-demo-treasury", String(nextTreasury));
      return nextTreasury;
    });
  }

  function processAllUnpaidSlots() {
    slots.forEach((_, index) => {
      processSlotPayment(index);
    });
  }

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-neutral-950 px-6 py-10 text-white">
        <section className="mx-auto max-w-6xl">
          <p className="text-neutral-400">Loading auction...</p>
        </section>
      </main>
    );
  }

  const liveWinner = phase === "live" ? winners[currentSlotIndex] : null;

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-neutral-400">
            pDOOH Auction
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Live DOOH Screen
          </h1>

          <p className="mt-4 max-w-2xl text-neutral-400">
            Bid for private advertising slots. All bids are hidden. Only the
            winner is revealed.
          </p>
        </div>

        <LiveScreen winner={liveWinner} />

        <AuctionArea
          phase={phase}
          secondsRemaining={secondsRemaining}
          currentSlotIndex={currentSlotIndex}
          slots={slots}
          advertisements={ads}
          slotStates={slotStates}
          walletBalance={walletBalance}
          submittedBids={submittedBids}
          winners={winners}
          onAdvertisementChange={(slot, value) =>
            updateSlot(slot, {
              selectedAdvertisement: value,
            })
          }
          onBidChange={(slot, value) =>
            updateSlot(slot, {
              bid: value,
            })
          }
          onPlaceBid={placeBid}
        />
      </section>
    </main>
  );
}