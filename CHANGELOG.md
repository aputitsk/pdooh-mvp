# pDOOH Development Changelog

This changelog records completed project milestones in development order. Entries dated June 22–23, 2026 are backed by Git commits. Later entries describe the completed current working-tree state audited on June 24, 2026 and do not imply separate commits.

## June 22, 2026

### Initial pDOOH Demo Foundation

Source: `6bb1251` — Initial pDOOH project

What changed:

- Created the Next.js application, shared navigation, landing page, Advertiser Dashboard, advertisement workspace, and auction screen.
- Added browser-based Business Profile, advertisement, wallet, internal balance, and auction state.
- Added the initial hidden-bid demo flow and Demo Bot behavior.

Why:

- Established an end-to-end browser demo for the pDOOH product concept.

Architectural result:

- The initial product operated as a client-side demo backed by browser storage.

### Auction Winners, Payments, and Storage Foundation

Source: `ad1e28b` — Auction architecture: winners, payments and storage foundation

What changed:

- Extracted auction winner selection into `lib/auction/auctionWinners.ts`.
- Extracted demo auction payment processing into `lib/auction/auctionPayments.ts`.
- Added dedicated auction storage helpers and paid-slot state.
- Standardized the locked auction phase in the auction UI.

Why:

- Removed winner selection, payment calculations, and persistence concerns from the auction UI.

Architectural result:

- Demo auction state, winner selection, and payment processing became explicit domain modules.

### Domain Boundaries and Project Reorganization

Source: `4bf940d` — Prepare pDOOH architecture for Arc integration

What changed:

- Organized advertiser, advertisement, auction, wallet, and money responsibilities under dedicated `lib` modules.
- Moved browser persistence into domain-specific storage modules.
- Added a public wallet facade under `lib/wallet`.
- Renamed Company terminology to Business Profile and Business Name where represented by the current product model.
- Reduced route components to orchestration and UI composition responsibilities.

Why:

- Created stable application boundaries before introducing blockchain-specific implementations.

Architectural result:

- Demo domain logic became separated from pages and prepared for adapter-based infrastructure.

### USDC Minor-Unit Money Model

Source: `4bf940d` — Prepare pDOOH architecture for Arc integration

What changed:

- Added `lib/money/usdc.ts`.
- Introduced `UsdcMinorUnits` for demo balances, bids, winner amounts, payments, and demo treasury values.
- Added centralized USDC parsing and formatting.
- Added minor-unit storage keys with legacy decimal values retained as migration/display mirrors.
- Added aggregate demo bid exposure validation against the internal demo balance.

Why:

- Removed floating-point decimal arithmetic from application money calculations.

Architectural result:

- Demo USDC amounts use a consistent 6-decimal minor-unit representation.

### Arc Adapter Boundary

Source: `17f0b61` — Add Arc adapter boundary

What changed:

- Added Arc Testnet constants.
- Added wallet, balance, and payment port types.
- Added mock Arc port implementations.

Why:

- Defined Arc-facing contracts without coupling the auction domain to a specific Arc implementation.

Architectural result:

- Arc infrastructure received an explicit boundary separate from demo auction logic.

## June 23, 2026

### AuctionEscrow Financial Contract

Source: `70f2b29` — Add AuctionEscrow smart contract milestone

What changed:

- Added `AuctionEscrow` with advertiser deposits, advertiser withdrawals, Operator settlement, settlement replay protection, and accounted escrow balances.
- Added Owner, Operator, and immutable Treasury roles.
- Added the standard ERC-20 USDC custody flow through `transferFrom` and `transfer`.
- Added Foundry configuration, a deployment script, Solidity test sources, and `MockUSDC`.

Why:

- Established a standalone financial boundary for USDC custody and settlement.

Architectural result:

- Escrow contract sources exist independently from the frontend and demo auction. This milestone does not establish deployment or frontend integration.

## Current Working State — Audited June 24, 2026

The milestones below are present in the current working tree after commit `70f2b29`. They are listed independently because they represent separate architectural results, but Git does not provide individual commit timestamps for them.

### Real Arc Wallet Integration

What changed:

- Replaced the active mock wallet runtime with injected browser-wallet discovery through EIP-6963 and a `window.ethereum` fallback.
- Added account access, wallet selection, authorized-session restoration, account-change handling, chain-change handling, and local application disconnect.
- Added the existing pDOOH sign-in signature request.
- Kept legacy mock wallet files outside the active runtime flow.

Why:

- Connected the existing Wallet Flow to a real external wallet while preserving the public `lib/wallet` facade.

Architectural result:

- Runtime UI uses the wallet boundary, while provider-specific behavior remains inside the Arc wallet adapter.

### Arc Testnet Network Handling

What changed:

- Added Arc Testnet chain switching and chain addition through the browser wallet provider.
- Configured chain ID `5042002`, the Arc Testnet RPC endpoint, USDC native currency metadata, and the Arc Testnet explorer.
- Added chain validation before balance and transfer operations.

Why:

- Ensured wallet and transaction operations execute against the configured Arc Testnet network.

Architectural result:

- Arc network handling is isolated in the Arc adapter layer rather than the UI or demo auction domain.

### Read-only ERC-20 USDC Balance

What changed:

- Added the Arc Testnet ERC-20 USDC address.
- Added a Viem public-client balance adapter using the standard ERC-20 `balanceOf` interface.
- Added the external-wallet USDC balance hook and Advertiser Dashboard display.
- Added validation for EVM addresses and the safe integer range.

Why:

- Exposed the connected wallet's actual Arc Testnet ERC-20 USDC balance without submitting a transaction.

Architectural result:

- External wallet USDC is explicitly separate from the internal demo balance.

### Treasury Configuration Boundary

What changed:

- Added validation for `NEXT_PUBLIC_PDOOH_TREASURY_ADDRESS`.
- Added public environment examples for Arc Testnet USDC, Treasury, Owner, and Operator addresses.
- Required the frontend Treasury and escrow Treasury configuration values to match in the deployment script.

Why:

- Prevented the frontend transfer destination and escrow settlement destination from silently diverging.

Architectural result:

- Treasury configuration is explicit and shared across the manual transfer and escrow deployment boundaries.

### Manual ERC-20 Treasury Transfer

What changed:

- Added a manual Advertiser Dashboard action for transferring Arc Testnet ERC-20 USDC to Treasury.
- Added Viem simulation, browser-wallet submission, and transaction receipt handling.
- Added waiting-for-wallet, pending, success, and error UI states.

Why:

- Added a real standalone blockchain payment operation without coupling it to demo auction playback or settlement.

Architectural result:

- The implemented blockchain payment is a direct ERC-20 `transfer`; it is not App Kit Send, an escrow deposit, or an auction payment.

### Payment Service Boundary

What changed:

- Added `lib/payments/paymentService.ts` and payment lifecycle types.
- Routed the runtime payment path through:
  `TreasuryTransferCard` → `paymentService` → wallet transaction layer → Arc transaction adapter.
- Kept Viem and Arc transaction calls out of runtime UI components.

Why:

- Preserved an application-level payment boundary between UI and blockchain infrastructure.

Architectural result:

- Manual blockchain payment orchestration is separate from demo auction payment logic.

### AuctionEscrow Domain and ABI Cleanup

What changed:

- Removed `screenId` and `slotId` from the `settle` function.
- Removed Operator, screen, and slot fields from the `Settled` event.
- Kept `settlementId` as the only pDOOH domain-layer identifier accepted or stored by escrow.
- Updated Solidity test sources to match the reduced contract interface.

Why:

- Kept pDOOH domain metadata outside the financial contract boundary.

Architectural result:

- `AuctionEscrow` now exposes a minimal financial ABI centered on advertiser, amount, and `settlementId`.

### Escrow Role and Deployment Configuration Audit

What changed:

- Added deployment validation for zero addresses.
- Restricted deployment configuration to the documented Arc Testnet ERC-20 USDC address.
- Required Owner, Operator, and Treasury to be distinct public addresses.
- Aligned the Operator environment variable with `PDOOH_OPERATOR_ADDRESS`.

Why:

- Made role separation and deployment assumptions explicit at the configuration boundary.

Architectural result:

- Owner controls Operator changes, Operator can settle, and immutable Treasury receives settlement, with no Operator Service represented in the project.

### Developer Reset Removal

What changed:

- Removed the Developer Tools reset card from the active UI.
- Removed active reset functions for wallet, advertiser, advertisement, and auction state.

Why:

- Removed the previous mock-only reset lifecycle after the active wallet flow moved to an external wallet.

Architectural result:

- The current runtime no longer presents a global developer reset as part of the product flow.

### Documentation Synchronization

What changed:

- Updated `ARCHITECTURE.md` to describe the hybrid demo and Arc Testnet architecture.
- Updated `ARC_INTEGRATION.md` to document the implemented wallet, network, balance, manual transfer, payment, and escrow boundaries.
- Updated `PROJECT.md` to describe the product as a Hybrid Arc-enabled Demo MVP.
- Updated this changelog to reflect committed history and the completed current working state.

Why:

- Removed outdated mock-only, empty-Arc-directory, App Kit Send, and reset-lifecycle claims, and clarified that escrow remains unconnected.

Architectural result:

- Project documentation consistently distinguishes the browser demo auction, manual blockchain transfer, and standalone unconnected escrow.

## Current Boundary Summary

- App Kit Send is not implemented.
- Automatic settlement is not implemented.
- `AuctionEscrow` is not connected to the frontend, payment service, wallet transaction flow, or demo auction.
- Blockchain auction payments are not implemented.
- Operator Service is outside the current project scope.
