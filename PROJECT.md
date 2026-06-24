# pDOOH MVP

Status: Hybrid Arc-enabled Demo MVP

## Product Overview

pDOOH is a private digital out-of-home advertising marketplace MVP. Advertisers can connect an external wallet, create a Business Profile and advertisements, place hidden bids for demo screen slots, and view the winning advertisement during playback.

The current project deliberately combines:

- a browser-based demo marketplace and auction;
- a limited Arc Testnet blockchain integration;
- a standalone `AuctionEscrow` financial contract that is present in the repository but is not connected to the frontend or demo auction.

Demo balances and demo auction payments must not be interpreted as blockchain funds or onchain settlement.

## Current Implemented Capabilities

### Product and Demo Features

- Landing page and shared navigation.
- Advertiser Dashboard.
- Business Profile creation with a Business Name.
- Automatic Demo Advertisement when the first Business Profile is created.
- Advertisement creation, deletion, duplicate-name protection, sorting, and browser synchronization.
- Internal demo balance funded through the demo deposit control.
- Three-slot hidden-bid auction.
- Demo Bot with a fixed hidden bid of 0.02 Test USDC.
- Winner selection and advertisement playback.
- Demo paid-slot processing that moves winning amounts from the internal demo balance to the demo treasury.

### Arc Testnet Features

- Injected browser-wallet discovery and selection.
- External wallet connection and local application disconnect.
- Arc Testnet network switching and network addition through the wallet provider.
- Restoration of an already authorized wallet session.
- Read-only ERC-20 USDC balance for the connected external wallet.
- Manual ERC-20 USDC transfer from the external wallet to the configured pDOOH Treasury address.
- Transaction lifecycle display for wallet confirmation, pending receipt, success, and error states.

### Smart Contract Sources

- `AuctionEscrow` contract source.
- Foundry deployment script.
- Solidity test sources and `MockUSDC`.

The repository does not establish that `AuctionEscrow` has been deployed. The contract and Solidity test sources are present, but Solidity test execution is not implied by their presence.

## Product Flow

The current product contains separate external-wallet, demo, and contract flows.

### External Arc Wallet Flow

1. The advertiser selects an injected browser wallet from the Navbar.
2. The application requests account access.
3. The wallet is switched to or configured for Arc Testnet.
4. The application requests the existing pDOOH sign-in signature.
5. The Advertiser Dashboard displays the connected address and read-only ERC-20 USDC balance.

The external wallet balance is real Arc Testnet ERC-20 USDC and is separate from the internal demo balance.

### Manual Treasury Transfer Flow

1. A connected advertiser enters an amount in the Treasury transfer card.
2. The payment service delegates the operation through the wallet transaction layer to the Arc transaction adapter.
3. The adapter submits a standard ERC-20 USDC `transfer` to the configured Treasury address.
4. The UI reports success only after a successful transaction receipt.

This is a manual standalone wallet-to-Treasury transaction. It is not an auction payment, automatic settlement, or escrow deposit. App Kit Send is not implemented.

### Demo Marketplace and Auction Flow

1. The connected advertiser creates a Business Profile.
2. The advertiser adds funds to the internal demo balance using the demo deposit control.
3. The advertiser creates and manages browser-stored advertisements.
4. The advertiser selects advertisements and submits hidden bids for demo screen slots.
5. Demo auction logic selects winners against the Demo Bot.
6. During playback, demo payment logic updates the internal demo balance, paid-slot state, and demo treasury.

This flow does not submit blockchain transactions and does not call the payment service or `AuctionEscrow`.

### AuctionEscrow Status

`AuctionEscrow` exists as a separate financial layer for ERC-20 USDC custody and settlement. It is not exposed in the current UI and is not called by the demo auction, payment service, or wallet transaction flow.

Its standard ERC-20 flow is:

`approve → transferFrom → transfer`

- An advertiser grants an ERC-20 USDC allowance.
- `deposit` receives USDC through `transferFrom`.
- `withdraw` returns USDC to the advertiser through `transfer`.
- `settle` transfers escrowed USDC to Treasury through `transfer`.

Native USDC value transfer is not used inside the escrow. `settlementId` is the only pDOOH domain-layer identifier accepted or stored by the contract.

## Component Separation

### Demo Components

- Business Profile and Business Name.
- Advertisements.
- Internal demo balance.
- Auction slots and hidden bids.
- Winner selection.
- Paid-slot markers.
- Demo treasury.

These components use browser storage and client-side demo logic.

### Blockchain Components

- External injected wallet.
- Arc Testnet network configuration.
- Read-only ERC-20 USDC balance.
- Manual ERC-20 Treasury transfer.
- Standalone `AuctionEscrow` source and deployment tooling.

The blockchain components do not perform auction settlement in the current project.

## Payment Service Boundary

The manual Treasury transfer follows this application boundary:

`TreasuryTransferCard` → `lib/payments/paymentService.ts` → `lib/wallet/walletTransactions.ts` → `lib/arc/arcTransactionAdapter.ts`

The runtime UI does not call the Arc transaction adapter or Viem directly. The demo auction payment logic is separate and does not use this boundary.

## Money Model

- Application ERC-20 USDC and demo amounts use `UsdcMinorUnits`.
- `UsdcMinorUnits` is represented as a safe JavaScript integer.
- ERC-20 USDC uses 6 decimal places.
- User input is parsed through `parseUSDCToMinorUnits`.
- Display values are formatted through `formatUSDCFromMinorUnits`.
- Legacy decimal browser-storage keys for the internal demo balance and demo treasury are retained as migration/display mirrors.
- Aggregate entered demo bid exposure cannot exceed the internal demo balance when a bid is placed.

The external ERC-20 USDC balance, internal demo balance, demo treasury, and escrow balances are separate concepts.

## Escrow Roles

Owner, Operator, and Treasury are distinct public addresses:

- Owner: controls changes to the escrow Operator through the ownership mechanism.
- Operator: may call `settle`.
- Treasury: immutable recipient of settled escrow USDC.

The deployment script requires these addresses to be different and requires the frontend Treasury configuration to match the escrow Treasury configuration.

Operator Service infrastructure is outside the current project scope.

## Current Limitations

- Business Profile, advertisements, internal balance, bids, winners, paid slots, and demo treasury are browser-local demo state.
- The manual Treasury transfer is not linked to an advertisement, auction slot, winner, or playback event.
- There is no real auction settlement.
- There are no blockchain auction payments.
- `AuctionEscrow` is not connected to the frontend.
- `AuctionEscrow` is not connected to the payment service.
- `AuctionEscrow` is not connected to the demo auction.
- App Kit Send is not implemented.
- The project does not establish an `AuctionEscrow` deployment.
- Operator Service is not implemented or represented as current infrastructure.
