# pDOOH Accounting Layer Design

Status: Implemented browser accounting with server-side operator settlement

Operator settlement is enabled through `/api/operator/process`.

## Purpose

The Accounting Layer sits between the demo Auction Engine and operator escrow settlement:

```text
Auction Engine -> Accounting Layer -> /api/operator/process -> AuctionEscrow
```

Each boundary has a separate responsibility:

- Auction Engine: produces the domain result, including the auction cycle, slot, winning advertisement, winning advertiser, and winning amount.
- Accounting Layer: converts a finalized domain result into a financial obligation, records its domain context, assigns a canonical `settlementId`, and tracks an off-chain reservation.
- Operator route: verifies an EIP-712 Bid Authorization before using `OPERATOR_PRIVATE_KEY` to submit settlement.
- Escrow: holds ERC-20 USDC and maintains advertiser custody balances. It does not determine auction winners or store auction domain data.
- Treasury: receives ERC-20 USDC when a settlement is executed successfully.

The Accounting Layer does not replace escrow custody. Escrow custody does not replace accounting.

## Current Architecture Gap

The current frontend supports an independent ERC-20 flow that approves the configured escrow and calls `deposit(amount)`. The current demo Auction Engine remains browser-based and does not call the escrow.

`AuctionEscrow` records:

- the advertiser address credited by `deposit`;
- the amount held for each advertiser;
- the total accounted escrow amount;
- whether a `settlementId` has already been processed.

It does not record:

- auction cycle;
- slot;
- advertisement;
- Business Profile;
- bid;
- winner-selection evidence;
- the domain reason for a settlement.

The Accounting Layer supplies this missing financial context outside the contract.

An escrow balance must not be described as an auction balance. Escrow reports custody. Accounting records which part of that custody is associated with unresolved financial obligations.

## Minimal Settlement Record

The planned minimal record is:

```ts
SettlementRecord {
  settlementId
  auctionCycleId
  advertiserAddress
  slotId
  advertisementName
  amountMinor
  status
  createdAt
  settledAt?
  transactionHash?
  failureReason?
}
```

Field responsibilities:

- `settlementId`: canonical `bytes32` identity passed to the contract by the operator route.
- `auctionCycleId`: identifies the demo auction cycle that produced the result.
- `advertiserAddress`: address whose escrow balance would be charged.
- `slotId`: domain slot associated with the obligation.
- `advertisementName`: current project advertisement reference. The current advertisement model has no stable advertisement ID.
- `amountMinor`: six-decimal ERC-20 USDC amount in the project's minor-unit representation.
- `status`: accounting lifecycle state.
- `createdAt`: time the financial obligation was recorded.
- `settledAt`: time successful settlement was confirmed.
- `transactionHash`: on-chain settlement transaction reference.
- `failureReason`: diagnostic information for a failed future attempt.

The advertiser signs an EIP-712 Bid Authorization at Place Bid. Settlement after playback remains automatic and does not require a wallet popup after winning.

Required accounting invariants:

- `settlementId` is unique.
- One auction cycle and slot produce at most one active financial obligation.
- `advertiserAddress` is non-zero and belongs to the finalized winner.
- `amountMinor` is a positive integer.
- Financial identity fields do not change after record creation.
- `settled` is valid only after a successful transaction receipt and matching `Settled` event.
- A settled record cannot be retried or cancelled.

These are Accounting Layer rules. They are not enforced by the current escrow contract except for non-zero settlement values, sufficient advertiser escrow balance, Operator authorization, and `settlementId` replay protection.

## settlementId Generation Principles

`settlementId` should be deterministic and generated in exactly one trusted accounting implementation.

Its input domain should include:

```text
accounting schema version
Arc chain ID
AuctionEscrow address
auction cycle ID
slot ID
advertiser address
amount in ERC-20 USDC minor units
```

The values should use a defined typed encoding and a cryptographic hash that produces `bytes32`. String concatenation is not sufficient because ambiguous serialization could produce inconsistent identifiers.

The principles are:

- the same financial obligation always produces the same identifier;
- different Arc networks or escrow deployments cannot collide;
- different auction cycles or slots cannot collide;
- changing the advertiser or amount creates a different financial obligation;
- generation is independent of UI labels and mutable presentation data;
- the algorithm is versioned before any production record is created.

The advertisement name is retained in the accounting record for domain traceability but is not part of the financial identity. The contract receives only `advertiser`, `amount`, and `settlementId`.

## Status Lifecycle

Supported statuses:

```text
pending
settled
failed
cancelled
```

Meaning:

- `pending`: the financial obligation exists and its amount is reserved by the Accounting Layer, but no successful settlement has been confirmed.
- `settled`: a settlement transaction succeeded and the emitted `Settled` event matches the record.
- `failed`: a settlement attempt failed or could not be confirmed. The obligation remains unresolved.
- `cancelled`: the obligation was invalidated before successful settlement and no longer reserves funds.

Allowed lifecycle:

```text
pending -> settled
pending -> failed
pending -> cancelled
failed  -> pending
failed  -> cancelled
```

`settled` and `cancelled` are terminal. A retry creates no new obligation and no new `settlementId`; it returns the existing failed record to `pending`.

## Reservation Model

Escrow custody is read from `AuctionEscrow.balanceOf(advertiser)`.

The off-chain reservation formula is:

```text
reservedAmount =
  active temporary bid reservations
  + unresolved retryable settlement obligations

availableToReserve =
  max(escrow.balanceOf(advertiser) - reservedAmount, 0)
```

`settled` records are not included because successful settlement reduces the on-chain escrow balance. `cancelled` records release their reservation.

This formula is an Accounting Layer calculation, not a contract function. The current `AuctionEscrow` does not store reservations and allows an advertiser to withdraw from their remaining on-chain balance. Therefore:

- accounting reservation is not an on-chain lock;
- the Accounting Layer must re-read escrow balance before accepting another obligation;
- the operator route must revalidate the balance before submitting settlement;
- `availableToReserve` can become zero when unresolved obligations exceed current custody;
- escrow balance and auction purchasing capacity must not be treated as identical without Accounting Layer validation.

## Lifecycle

The lifecycle is:

1. The Auction Engine produces a finalized winner result.
2. A trusted boundary validates the auction cycle, slot, winner address, and amount.
3. Accounting checks uniqueness and calculates `availableToReserve`.
4. Accounting creates one immutable `pending` `SettlementRecord`.
5. The amount is considered reserved off-chain.
6. The operator route reads the pending obligation and revalidates current escrow custody.
7. The operator route verifies bid authorization, then submits `settle(advertiser, amount, settlementId)`.
8. Accounting waits for a successful receipt and verifies the `Settled` event fields.
9. Accounting marks the record `settled`, or `failed` when the attempt cannot be confirmed.

The route does not trust browser JSON directly. Vercel must store `OPERATOR_PRIVATE_KEY` only as a server-side environment variable.

## What Remains Demo

The following current features remain browser-based demo behavior:

- auction clock and cycle progression;
- slot selection;
- bids and submitted-bid markers;
- Demo Bot participation;
- winner selection;
- Business Profile and advertisements;
- internal demo balance;
- paid-slot markers;
- demo Treasury;
- demo payment processing during playback.

The current demo auction state is stored in `localStorage` and is not trusted production settlement evidence. The Accounting Layer must not interpret a demo paid-slot marker as an on-chain settlement.

## What Must Not Be Implemented Yet

This design does not authorize:

- trusting browser JSON for settlement;
- exposing `OPERATOR_PRIVATE_KEY` to the browser;
- creating production settlement records from current `localStorage` state;
- changing `AuctionEscrow.sol`;
- changing Wallet Flow;
- replacing the demo balance or demo Treasury;
- changing demo winner selection or payment logic;
- adding accounting UI;
- claiming that escrow custody equals auction balance.

The Accounting Layer remains the contract between domain results and operator settlement.

## Risks of Skipping the Accounting Layer

Without this layer, the project cannot reliably:

- prevent two financial obligations for the same auction slot;
- calculate how much escrow custody is already reserved;
- explain why a Treasury transfer occurred;
- bind an on-chain settlement to an auction cycle, slot, winner, and advertisement;
- generate the same `settlementId` during retry;
- distinguish an unresolved obligation from a successful settlement;
- reconcile a transaction receipt and `Settled` event with the domain result;
- detect that browser state was changed after winner selection;
- audit failed, cancelled, retried, or settled obligations;
- keep direct Treasury transfers, escrow custody, and auction obligations conceptually separate.

Contract replay protection prevents reuse of an already processed `settlementId`, but it does not prove that the original settlement represented a valid auction result. That proof belongs to the future Accounting and Operator boundaries.
