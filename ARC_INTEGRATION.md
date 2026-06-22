# pDOOH Arc Integration

Status: Planned, not implemented

## Current Reality

The current MVP is a working demo built on mock modules and browser storage. There is no Arc SDK integration in the codebase yet.

`lib/arc` exists as an empty directory. It does not currently provide an adapter, wallet connector, payment client, or balance reader.

## Existing Boundaries

These modules are the places to replace mock behavior later:

- `lib/wallet`: mock wallet facade used by Navbar and app pages.
- `lib/advertiser`: Business Profile and demo balance storage.
- `lib/advertisements`: Advertisement storage and rules.
- `lib/auction`: bidding, winner selection, payment processing, and auction storage.
- `lib/money/usdc.ts`: USDC parsing, formatting, and minor-unit representation.

## Next Arc Step

Create an Arc adapter boundary before replacing behavior.

The adapter should provide Arc-compatible implementations for:

- wallet connection and wallet state;
- Test USDC balance reads;
- payment execution;
- any persistent storage or sync needed by advertisements and auctions.

## Migration Approach

Replace mock modules behind existing boundaries, one area at a time:

1. Mock wallet -> Arc-compatible wallet implementation.
2. Mock balance storage -> Arc-compatible balance source.
3. Mock payments -> Arc-compatible Test USDC payment flow.
4. Browser storage sync -> Arc-compatible persistence or synchronization where needed.

## Rules

- Do not redesign pages for Arc.
- Keep Advertiser, Business Profile, Business Name, and `Advertisement.businessName` terminology.
- Keep USDC values in minor units internally.
- Do not document Arc APIs until the actual SDK or adapter code exists.
- Official Arc documentation should be checked before implementing the adapter.
