# pDOOH Contract Auction V1

Status: implemented, deployed on Arc Testnet, and smoke-tested without switching the frontend.

This adds a contract-backed auction authority next to the existing browser/legacy path. The current frontend remains unchanged, and `src/AuctionEscrow.sol` remains the legacy/testnet escrow.

## Deliverables

- New contracts:
  - `src/AuctionEscrowV2.sol`
  - `src/AuctionEngineV1.sol`
  - `src/AuctionIds.sol`
- Foundry coverage:
  - `test/AuctionEngineV1.t.sol`
  - existing `test/AuctionEscrow.t.sol` remains unchanged except that `MockUSDC.decimals()` is virtual for the new decimal-mismatch test.
- Deployment/config scripts:
  - `script/DeployAuctionEngineV1.s.sol`
  - `script/ConfigureAuctionEngineV1Site.s.sol`
  - `script/SmokeAuctionEngineV1.s.sol`
- Arc Testnet smoke runbook:
  - `ARC_TESTNET_SMOKE.md`
## Contract Split

### AuctionEscrowV2

`AuctionEscrowV2` is a USDC vault only. It owns custody, balances, available/reserved accounting, and engine-owned reservations.

Public API:

- `deposit(uint256 amount)`
- `withdraw(uint256 amount)`
- `balanceOf(address account)`
- `availableOf(address account)`
- `reservedOf(address account)`
- `reserve(address payer, uint256 amount, address beneficiary, bytes32 reservationId)`
- `settleReservation(bytes32 reservationId, uint256 finalAmount, bytes32 settlementId)`
- `releaseReservation(bytes32 reservationId)`
- `getReservation(bytes32 reservationId)`
- `setEngine(address engine)`

Rules:

- ERC-20 USDC only, checked at construction with `decimals() == 6`.
- No `payable` functions and no native-value accounting.
- `withdraw` spends available balance only.
- `available + reserved == balance` for each account.
- Internal `totalAccounted <= USDC.balanceOf(escrow)` allows unsolicited token surplus without breaking accounting.
- Reservations are immutable in `payer`, `beneficiary`, `engine`, and `reservedAmount`.
- `ENGINE_ROLE` is bound once through `setEngine`; direct `grantRole(ENGINE_ROLE, ...)` is disabled.
- Only the configured engine can create reservations.
- Only the engine that created a reservation can settle or release it.
- `finalAmount <= reservedAmount`.
- Settlement can only happen against an active reservation and a fresh nonzero `settlementId`.

### AuctionEngineV1

`AuctionEngineV1` is the authority for site configs, deterministic cycles, slot bids, paid winner selection, playback confirmation, expiry, and settlement eligibility.

Public API summary:

- Config:
  - `configureInitialSite(bytes32 siteId, SiteConfigInput input)`
  - `configureNextSiteVersion(bytes32 siteId, SiteConfigInput input)`
  - `snapshotCycle(bytes32 siteId, uint64 cycleId)`
  - `previewCycle(bytes32 siteId, uint64 cycleId)`
  - `currentCycleId(bytes32 siteId)`
  - `getSiteConfig(bytes32 siteId, uint32 version)`
  - `getSiteConfigForCycle(bytes32 siteId, uint64 cycleId)`
  - `getCycleSnapshot(bytes32 siteId, uint64 cycleId)`
- Auction lifecycle:
  - `placeBid(bytes32 siteId, uint64 cycleId, uint8 slotIndex, bytes32 advertisementId, uint256 amount)`
  - `finalizeSlot(bytes32 siteId, uint64 cycleId, uint8 slotIndex)`
  - `confirmPlayback(PlaybackReport report)`
  - `expireSlot(bytes32 siteId, uint64 cycleId, uint8 slotIndex)`
  - `settleSlot(bytes32 siteId, uint64 cycleId, uint8 slotIndex)`
- Views/helpers:
  - `getBid(bytes32 bidId)`
  - `getSlotState(bytes32 siteId, uint64 cycleId, uint8 slotIndex)`
  - `getSlotBidCount(bytes32 siteId, uint64 cycleId, uint8 slotIndex)`
  - `slotKey(...)`, `bidId(...)`, `reservationId(...)`, `settlementId(...)`
- Pause:
  - `pause()`
  - `unpause()`

Initial product config:

- `OPEN = 60s`
- `LOCKED = 2s`
- `PLAYBACK = 10s per slot`
- `SLOT_COUNT = 3`
- `minimumPaidBid = 20_000` USDC minor units, equal to `0.02` Test USDC.
- `MAX_BIDS_PER_SLOT = 10`

`previewCycle` is read-only and can inspect future cycles. `snapshotCycle` persists a cycle snapshot only after that cycle starts, so a third party cannot grief future config updates by pre-snapshotting future cycles.

## IDs

All deterministic IDs use versioned domain separators and `abi.encode`, not ambiguous packed dynamic-string encoding.

- `siteId`: computed outside the authority path from a canonical site key.
- `slotKey`: `pdooh.slotKey.v1(siteId, cycleId, slotIndex)`
- `bidId`: `pdooh.bidId.v1(slotKey, bidder)`
- `reservationId`: `pdooh.reservationId.v1(bidId)`
- `settlementId`: `pdooh.settlementId.v1(slotKey, bidder, advertisementId)`
- `configHash`: `pdooh.configHash.v1(ConfigHashInput)`
- `playbackReportDigest`: `pdooh.playbackReportDigest.v1(PlaybackReportInput)`

`businessName`, display names, slugs, city names, and Redis metadata are not in deterministic contract IDs.

## Role Model

- `DEFAULT_ADMIN_ROLE`: grants/revokes non-engine roles and binds the single escrow engine once.
- `CONFIG_ADMIN_ROLE`: configures initial sites and future config versions.
- `REPORTER_ROLE`: submits playback reports through `confirmPlayback`.
- `PAUSER_ROLE`: pauses new bids.
- `ENGINE_ROLE` on `AuctionEscrowV2`: one-time bound to `AuctionEngineV1` through `setEngine`, so the admin cannot later grant itself or another helper reservation/settlement authority.

Admin cannot assign winners, alter bids, choose settlement amounts, withdraw user funds, or change active/past cycle snapshots. Pausing blocks new bids but does not block escrow withdrawals or recovery flows such as expiry/settlement.

The deploy script requires role addresses to be nonzero but does not force them to be distinct, which keeps Arc Testnet smoke runs practical. Production deployments should still separate admin, config admin, reporter, and pauser keys operationally.

## Deployment Order

Do not deploy without an explicit command.

1. Verify Arc Testnet config:
   - chain id `5042002`
   - RPC `https://rpc.testnet.arc.network`
   - explorer `https://testnet.arcscan.app`
   - ERC-20 USDC `0x3600000000000000000000000000000000000000`
2. Run `DeployAuctionEngineV1.s.sol` from the admin broadcaster:
   - deploys `AuctionEscrowV2`
   - deploys `AuctionEngineV1`
   - binds `ENGINE_ROLE` to the engine through `setEngine`
3. Run `ConfigureAuctionEngineV1Site.s.sol` from the config-admin broadcaster:
   - configures one initial `bytes32 siteId`
   - uses the initial product timing and threshold above
   - requires `PDOOH_PROOF_DEADLINE_SECONDS`; use `60` for the smoke run so reporter confirmation has an operational window
4. Grant additional reporters/pausers only after address review.
5. Run local tests, then the phased Arc Testnet smoke scripts in `ARC_TESTNET_SMOKE.md` before any app switch.

The deploy script intentionally does not implement funding, bridge, CCTP, App Kit, Gateway, APS, or private EVM logic.

## Local Test Coverage

Implemented Foundry coverage includes:

- deposit/withdraw/available/reserved accounting;
- `available + reserved == balance`;
- internal totals less than or equal to actual USDC balance;
- one bid per bidder per slot;
- max 10 bids per slot;
- three bids across three slots;
- aggregate available balance across sites/cycles/slots;
- config snapshots per cycle;
- no retroactive config changes;
- current timing reference `60s/2s/3x10s`;
- async site schedules;
- no on-chain Demo Bot;
- `minimumPaidBid` threshold;
- loser release;
- winner proof to settlement;
- reporter can confirm a playback report that starts at the slot start, ends 4 seconds later, and then settle the slot;
- proof expiry to release;
- settlement revert leaves slot `PLAYED` and reservation active for retry;
- treasury cannot bid;
- reporter/browser cannot inject a different winner advertisement or settlement amount;
- reporter cannot confirm playback before the reported playback end time;
- future cycles cannot be snapshotted before they start;
- admin cannot directly grant a new escrow engine or change the configured engine;
- phased Arc Testnet smoke scripts compile with the contracts;
- no native value path;
- ERC-20 USDC 6 decimals.

## Gas Measurements

Local command: `forge test --gas-report`

Key measurements:

- `AuctionEngineV1` deployment: `3,214,383` gas, size `14,922` bytes.
- `AuctionEscrowV2` deployment: `1,207,891` gas, size `5,820` bytes.
- `placeBid`: max `470,599`, average `323,084`.
- `finalizeSlot`: max `561,882`, average `210,396`.
- `confirmPlayback`: max `105,621`, average `80,537`.
- `settleSlot`: max `209,255`, average `193,288`.
- `AuctionEscrowV2.reserve`: max `170,660`, average `170,639`.
- `AuctionEscrowV2.settleReservation`: max `148,125`, average `73,921`.
- `AuctionEscrowV2.setEngine`: max `72,296`, average `71,936`.

The current worst-case slot path is bounded by `MAX_BIDS_PER_SLOT = 10`.

## Known Limitations

- Application contract mode is not wired yet; the next app step is a `legacy | contract_v1` flag.
- Current Arc Testnet smoke covered paid winner playback settlement, proof expiry release, and the `0.02` threshold `NO_PAID_WINNER` release path.
- Redis/browser state remains the existing product store today; once contract mode is wired, Redis should be projection only after receipt and chain-state reads.
- No APS verifier contract in V1. `REPORTER_ROLE` is used inside `AuctionEngineV1`.
- No bid cancel, slot cancel, bid replacement, or bid increase in V1. This matches the current submitted-bid legacy path, where `submittedBids[slot]` blocks another submit for the same slot.
- No on-chain Demo Bot wallet, escrow deposit, reservation, settlement, or revenue path. The authoritative contract state for bids at or below `minimumPaidBid` is `NO_PAID_WINNER`; UI/screen fallback may only be a deterministic display projection from that contract outcome, the snapshot `minimumPaidBid`, and static product advertisement config.
- No admin migration from legacy `AuctionEscrow`.
- No funding adapters inside Engine or Escrow.
- Repeat Arc Testnet contract smoke after any contract, site config, or settlement-flow change because local EVM does not reproduce all Arc behavior.

## Legacy Path

Confirmed unchanged:

- `src/AuctionEscrow.sol` was not edited.
- `script/DeployAuctionEscrow.s.sol` was not edited.
- Frontend auction, wallet, operator, and Redis routes were not switched to the new contracts.

Existing users must withdraw legacy balances themselves; there is no admin migration path.

## Product Parity Invariant

Contract V1 must replace the internal source of truth and trust model without changing the externally visible mechanics of the existing application unless a product change is explicitly approved.

The migrated experience must preserve:

- the same phases and timings: `open 60s`, `locked 2s`, then three sequential live slots of `10s` each;
- the same `open -> locked -> live slot 1 -> live slot 2 -> live slot 3 -> next cycle` sequence;
- the same three advertising slots;
- the same advertisement selection, bid input, and bid submission UX;
- the same AppKit and Privy confirmation flow;
- the same Demo Bot bid of `0.02 Test USDC` until a different behavior is explicitly approved;
- the same winner selection rules;
- the same winner and advertisement display order;
- the same `Balance`, `Reserved`, and `Available` concepts;
- reservation on bid;
- correct reservation replacement or increase on a new bid;
- release of losing, replaced, cancelled, expired, and unused reservations;
- charging only the won and playback-confirmed slot amount;
- no double charge;
- the same withdraw UX with reserved amount protection;
- the same settlement receipts and account revenue projections;
- the same site keys, advertisements, and slot mapping;
- the same visible behavior after reload and page changes.

Only authority changes:

- cycle, slot state, bids, winner, and reservations become Contract V1 truth;
- localStorage and Redis may only be cache/projection where still needed;
- the browser must not appoint a winner or settlement amount;
- settlement and release must follow contract rules;
- lifecycle automation must not depend on a single browser heartbeat.

Any unintended difference from current legacy behavior is a migration defect.

If Contract V1 cannot reproduce part of the current product mechanics:

- do not add a frontend workaround;
- do not return authority to localStorage or Redis;
- do not silently change UX or economic rules;
- record the exact mismatch;
- identify whether the fix belongs in the contract, config, or adapter layer;
- stop before shipping incompatible behavior.

Every future action switch must include a parity matrix:

| Field | Required comparison |
| --- | --- |
| user input/action | Legacy action and Contract V1 action must be the same from the user's point of view. |
| legacy result | Current app behavior before migration. |
| Contract V1 result | Contract result and state transition. |
| UI-visible result | What the user sees on `/screen` and `/advertiser`. |
| balance delta | Change to `Balance`. |
| reserved delta | Change to `Reserved` and `Available`. |
| settlement delta | Settlement, receipt, and revenue projection effect. |
| timing | Phase, slot, and retry timing. |
| reload recovery | Behavior after refresh or page change. |
| retry/idempotency | Duplicate submit, retry, and already-processed behavior. |

### Current Parity Notes

- Playback confirmation does not require the full 10-second slot window to elapse. `confirmPlayback` requires `block.timestamp >= report.playbackEndedAt`, `report.playbackStartedAt >= slotStart`, and `report.playbackEndedAt <= slotEnd`. A trusted reporter can therefore submit a report for `slotStart -> slotStart + 4s` at `slotStart + 4s`, and `settleSlot` can run immediately after confirmation.
- The Contract V1 Demo Bot mapping is deterministic display projection, not authority. When the contract finalizes `NO_PAID_WINNER`, the app may display the existing Demo Bot fallback advertisement and compare against the snapshot `minimumPaidBid`, but it must not create a paid winner, reservation, settlement, or revenue entry.
- Current legacy repeat-bid behavior is one submitted bid per slot. After `submittedBids[slot]` is true, same-slot bid replacement, increase, decrease, and ad changes are blocked by the legacy app; V1 duplicate bid rejection is therefore equivalent for the current product behavior.

## Application Read-Only Foundation

The app now has an isolated Contract V1 read-only foundation under `lib/arc/contractV1`.
It is not wired into the production UI, legacy stores, settlement scanner, operator routes, wallet flows, or Redis projection.

### Mode and Address Env

Public app env:

- `NEXT_PUBLIC_PDOOH_AUCTION_MODE`: `legacy` or `contract_v1`; missing value defaults to `legacy`.
- `NEXT_PUBLIC_PDOOH_AUCTION_ESCROW_V2_ADDRESS`: `AuctionEscrowV2` address for Contract V1 reads.
- `NEXT_PUBLIC_PDOOH_AUCTION_ENGINE_V1_ADDRESS`: `AuctionEngineV1` address for Contract V1 reads.

Guardrails:

- Unknown mode values fall back to `legacy` and surface a diagnostic error.
- Missing V1 addresses do not break `legacy` mode.
- In `contract_v1` mode, missing, invalid, or zero V1 addresses are diagnostic errors.
- V1 address config does not reuse `NEXT_PUBLIC_PDOOH_ESCROW_ADDRESS`, which remains the legacy `AuctionEscrow` address.
- Deployment addresses are intentionally not hardcoded in app code.

### Site ID Mapping

Contract V1 site ids use `AuctionIds.siteId(canonicalSiteKey)`:

```text
keccak256(abi.encode(keccak256("pdooh.siteId.v1"), canonicalSiteKey))
```

The canonical input is the exact app `siteKey`, for example `new-york/times-square`.
Display names, city names, business names, Redis metadata, and page labels are not ID inputs.

All real application site keys currently found in `lib/auction/siteConfig.ts`:

| Canonical application site key | Computed `bytes32 siteId` | Deployment/config proof | Status |
| --- | --- | --- | --- |
| `new-york/times-square` | `0x8cf3e0bc4b551deafc95cab2f38acbf1eae9a58ab3a8fe8b6be5bf3279331672` | `.env.arc-smoke.local.template` sets `PDOOH_INITIAL_SITE_ID`/`PDOOH_SMOKE_SITE_ID`; `script/ConfigureAuctionEngineV1Site.s.sol` reads `PDOOH_INITIAL_SITE_ID`; `broadcast/ConfigureAuctionEngineV1Site.s.sol/5042002/run-latest.json` calls `configureInitialSite` with the same value. | proven |
| `los-angeles/hollywood-boulevard` | `0xeafcd6dbd8ec28ca540b1bd01c1b86bfcf3cd652b4d75e9ce14f8683c1781bfe` | No deployment/config script or broadcast currently configures this site id. Algorithm is confirmed by the `AuctionIds` formula and the NY vector, but concrete LA deployment mapping is not proven on-chain. | not configured |

### Read-Only Diagnostics Boundary

The read layer uses the existing Arc public client/RPC fallback. It does not create another public client, does not use a wallet provider, and does not call write methods.

Read-only coverage:

- `AuctionEscrowV2`: `balanceOf`, `availableOf`, `reservedOf`, `getReservation`, `engine`, `usdc`.
- `AuctionEngineV1`: `currentCycleId`, `previewCycle`, `getSiteConfig`, `getSiteConfigForCycle`, `getCycleSnapshot`, `getSlotState`, `getSlotBidCount`, `escrow`.

Diagnostics return mode/config validity, chain id, V1 addresses, computed site id, current/effective cycle id, preview and persisted cycle snapshot, site config, slot states and bid counts, wallet escrow balance/available/reserved, `available + reserved == balance`, escrow-engine match, engine-escrow match, USDC address, warnings, and errors.

### Minimal Runtime Foundation Boundary

The Contract V1 runtime foundation is a pure TypeScript domain layer only.
Runtime modes remain `legacy | contract_v1`; there is no shadow app mode.

The foundation may compose existing config/site id/read types, derive UI phase/current slot from Contract V1 snapshot timestamps, classify minimal read/config errors, and compute pure preflight eligibility for future wallet-owned `deposit`, `withdraw`, and `placeBid` actions.

It is not wired into UI, React providers, wallet adapters, Redis, legacy stores, settlement routes, lifecycle automation, reporter submission, or projections. Site support must be confirmed by Contract V1 reads; deployment metadata is diagnostics-only. Eligibility is a preflight helper, not final write authority: future write adapters must reread chain state before submitting transactions.

`AuctionEscrowV2` balances are global per wallet, not per site. Low-level V2 `approve`, `deposit`, and `withdraw` adapters are therefore site-independent. Active-site support is only an application rollout/product-readiness gate for whether to expose a deposit flow while a site is not yet configured; it is not an escrow contract precondition. The deposit/withdraw foundation does not mean V2 funds are already connected to bidding, lifecycle, settlement, or revenue projections.

### Still Not Connected

These remain intentionally unconnected:

- V2 `approve`, `deposit`, `withdraw`.
- Engine `placeBid`.
- `finalizeSlot`, `confirmPlayback`, `expireSlot`, `settleSlot`.
- playback proof or reporter flow.
- Redis projections after receipts.
- Contract V1 UI mode for `/screen` or `/advertiser`.
- settlement scanner and operator routes.
- public diagnostic page or API endpoint.

## Application Integration Guardrails

- Do not add a browser heartbeat that performs operator actions.
- Do not expose a public route that holds or uses a private key.
- Do not submit `success=true` on a timer as a stand-in for playback proof.
- Do not rely on localStorage alone for mode locks or cycle safety.
- Do not mix the legacy `OPERATOR_PRIVATE_KEY` with new contract roles.
- Do not build an automatic `finalize -> confirm -> settle` giant loop.
- Design any relayer/operator path separately after read-only diagnostics and wallet-owned flows are stable.

## Separate Application Migration Plan

1. Add a config flag: `legacy | contract_v1`.
2. Add contract reads in the app: cycle snapshot, slot state, escrow balance, available, and reserved.
3. Make the UI/routes stop treating browser-submitted winner or amount as authority.
4. For contract-mode sites, route `approve/deposit` and `placeBid` through `AuctionEscrowV2` and `AuctionEngineV1`.
5. Keep Redis only as projection after receipt and chain-state reads.
6. Do not switch an existing site mid-cycle.
7. Ensure `siteId + cycleId + slotIndex` can never settle through both legacy and contract paths.
8. User migration remains manual:
   - withdraw from legacy `AuctionEscrow`;
   - approve `AuctionEscrowV2`;
   - deposit into `AuctionEscrowV2`.
