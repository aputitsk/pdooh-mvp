import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { getAvailableFromEscrowBalance, getTotalReservedAmount, getTotalSiteReservedAmount, type SiteReservedAmount } from "./reservedAmounts.ts";

const siteReservedAmounts: SiteReservedAmount[] = [
  {
    siteKey: "new-york/times-square",
    reservedAmount: 1_500_000,
  },
  {
    siteKey: "los-angeles/hollywood-boulevard",
    reservedAmount: 2_000_000,
  },
];

test("total site reserved amount sums reservations across every site", () => {
  assert.equal(getTotalSiteReservedAmount(siteReservedAmounts), 3_500_000);
});

test("total reserved amount keeps legacy settlement obligations as a global add-on", () => {
  assert.equal(
    getTotalReservedAmount({
      siteReservedAmounts,
      legacyUnresolvedSettlementReservedAmount: 750_000,
      pendingSettledReservedAmount: 250_000,
    }),
    4_500_000
  );
});

test("available amount subtracts total reserved from one shared escrow balance", () => {
  assert.equal(
    getAvailableFromEscrowBalance(
      5_000_000,
      getTotalReservedAmount({
        siteReservedAmounts,
        legacyUnresolvedSettlementReservedAmount: 750_000,
      })
    ),
    750_000
  );
});

test("available amount does not go below zero", () => {
  assert.equal(getAvailableFromEscrowBalance(1_000_000, 2_000_000), 0);
});
