# pDOOH MVP Architecture

Status: Current hybrid demo and Arc Testnet MVP

## Architecture Summary

The project combines three intentionally separate areas:

- a browser-based demo domain for advertiser onboarding, advertisements, auctions, internal balances, winner selection, and demo payments;
- an Arc Testnet integration layer for an external wallet, ERC-20 USDC balance reads, a manual wallet-to-treasury USDC transfer, and an independent escrow deposit flow;
- an Accounting Layer between finalized auction results and operator escrow settlement.

Operator settlement is enabled through the Vercel API route at `/api/operator/process`. Settlement after playback remains automatic and does not require another wallet popup after winning.

## Project Structure

- `app/`: Next.js pages and route-level client containers.
- `components/`: UI components grouped by product area.
- `lib/advertiser/`: demo Business Profile and internal balance state.
- `lib/advertisements/`: demo advertisement types, rules, and storage.
- `lib/auction/`: demo auction clock, bids, winner selection, payments, and storage.
- `lib/wallet/`: wallet-facing application facade, wallet state hooks, Arc USDC balance hook, and wallet transaction orchestration.
- `lib/payments/`: payment boundary used by the UI for manual Treasury transfers and independent escrow deposits.
- `lib/arc/`: Arc Testnet constants, configuration, wallet adapter, balance adapter, transaction adapter, and escrow adapter.
- `lib/money/`: USDC parsing, formatting, and minor-unit representation.
- `src/`: Solidity contracts.
- `script/`: Foundry deployment scripts.
- `test/`: Solidity test sources and `MockUSDC`.

## Pages

- `app/page.tsx`: landing page.
- `app/advertiser/page.tsx`: advertiser onboarding, external wallet information, manual treasury transfer, Business Profile, and demo internal balance.
- `app/advertisements/page.tsx`: demo advertisement management.
- `app/screen/page.tsx`: demo auction and live advertisement playback.
- `app/layout.tsx`: shared root layout and navigation.

## Demo Domain

The following state remains browser-based and is not persisted onchain:

- Business Profile and Business Name;
- advertisements;
- internal demo wallet balance;
- auction cycle and slot inputs;
- submitted bid markers;
- winner selection;
- paid-slot markers;
- demo treasury balance.

React client stores synchronize this state through `localStorage`, browser storage events, and project-specific change events.

The demo auction payment logic only updates the internal demo balance and demo treasury. It does not call `lib/payments`, an Arc adapter, or `AuctionEscrow`.

## Wallet Boundary

Runtime UI imports the public facade from `lib/wallet`.

The active wallet implementation:

- discovers injected browser wallets through EIP-6963, with `window.ethereum` as a fallback;
- requests the selected account through the browser wallet provider;
- switches to or adds Arc Testnet;
- requests the existing pDOOH sign-in signature;
- restores an already authorized wallet session;
- tracks account and chain changes;
- exposes wallet state to React through the wallet facade.

Application disconnect is local to the pDOOH session and is recorded in `sessionStorage`. It does not revoke permissions inside the external wallet.

## Arc Boundary

`lib/arc` isolates Arc-specific network and provider behavior:

- `arcConstants.ts`: Arc Testnet chain ID, RPC URL, explorer URL, native currency metadata, and the Arc Testnet USDC ERC-20 address.
- `arcConfig.ts`: validates the public pDOOH Treasury address.
- `arcWalletAdapter.ts`: injected wallet discovery, Arc Testnet switching, wallet session state, and Circle Viem adapter initialization.
- `arcBalanceAdapter.ts`: reads the external wallet's USDC balance through the standard ERC-20 `balanceOf` interface.
- `arcTransactionAdapter.ts`: simulates, submits, and waits for the current wallet-to-treasury ERC-20 USDC transfer.
- `arcEscrowAdapter.ts`: validates the configured escrow and performs the independent ERC-20 `approve -> deposit` flow.
- `arcPorts.ts`: Arc-facing wallet, balance, and payment port types.

The demo domain does not import Arc SDK or Viem modules.

## Payment Boundary

Runtime UI initiates the manual treasury payment through:

`TreasuryTransferCard` → `lib/payments/paymentService.ts` → `lib/wallet/walletTransactions.ts` → `lib/arc/arcTransactionAdapter.ts`

The UI does not call the Arc transaction adapter or Viem directly.

The current payment operation is a direct ERC-20 USDC `transfer` from the connected advertiser wallet to the configured pDOOH Treasury address. It is a manual standalone Arc Testnet transaction and is not auction settlement, an escrow deposit, or an App Kit Send implementation.

Payment lifecycle callbacks expose the waiting-for-wallet and pending-transaction states. Success is reported after the transaction receipt has a successful status.

## Money Representation

- Demo and ERC-20 USDC application amounts use `UsdcMinorUnits`.
- `UsdcMinorUnits` is currently represented as a safe JavaScript integer.
- ERC-20 USDC amounts use 6 decimal places.
- User input is parsed through `parseUSDCToMinorUnits`.
- Display values are formatted through `formatUSDCFromMinorUnits`.
- Legacy decimal localStorage values for the demo internal balance and demo treasury are maintained as migration/display mirrors beside minor-unit keys.

Arc native USDC is used by the network for gas, but the application and escrow token operations use the standard 6-decimal ERC-20 USDC interface. Native USDC value transfer is not used inside `AuctionEscrow`.

## AuctionEscrow Financial Boundary

`src/AuctionEscrow.sol` is a standalone USDC escrow contract. The current frontend can call `deposit(amount)` through the payment, wallet, and Arc adapter boundaries. The demo auction does not call the contract.

The escrow is exclusively a financial boundary:

- advertiser balances are keyed by advertiser public address;
- `deposit(amount)` credits only `msg.sender`;
- `withdraw(amount)` returns funds only to `msg.sender`;
- `settle(advertiser, amount, settlementId)` can be called only by the Operator;
- settlement transfers escrowed USDC to the immutable Treasury;
- replay protection is keyed by `settlementId`;
- `totalEscrowed` tracks accounted advertiser balances.

No pDOOH domain identifiers are stored or accepted by the escrow other than `settlementId`. In particular, screen, slot, advertisement, campaign, auction, and Business Profile identifiers are absent from the contract interface and storage.

The escrow uses the standard ERC-20 USDC flow:

1. The advertiser approves the escrow contract to spend an amount of USDC.
2. `deposit` receives USDC through `transferFrom`.
3. `withdraw` or `settle` sends USDC through `transfer`.

The escrow does not use Arc native USDC value transfer.

## Escrow Roles and Configuration

Owner, Operator, and Treasury are separate public addresses with separate responsibilities:

- Owner: controls the Operator address through the contract's ownership mechanism.
- Operator: may execute `settle`.
- Treasury: immutable recipient of settled USDC.

The deployment script rejects zero configuration addresses, requires the configured Arc Testnet ERC-20 USDC address, requires the frontend Treasury and escrow Treasury values to match, and requires Owner, Operator, and Treasury to be distinct.

The Vercel deployment must store `OPERATOR_PRIVATE_KEY` only as a server-side environment variable.

## Accounting Layer

The Accounting Layer sits between the Auction Engine and operator escrow settlement:

`Auction Engine -> Accounting Layer -> /api/operator/process -> AuctionEscrow -> Treasury`

Responsibilities remain separate:

- Auction Engine produces the domain result.
- Accounting records the financial obligation, domain context, canonical `settlementId`, lifecycle, and off-chain reservation.
- The advertiser signs an EIP-712 Bid Authorization at Place Bid.
- `/api/operator/process` verifies that authorization before using `OPERATOR_PRIVATE_KEY`.
- The route does not trust browser JSON directly.
- Escrow provides ERC-20 USDC custody and settlement replay protection.
- Treasury is the immutable settlement destination.

Escrow balance is custody, not auction balance. The Accounting Layer calculates unresolved reservations without adding auction identifiers to the contract.

The planned record, identifier rules, status lifecycle, reservation formula, exclusions, and risks are defined in [ACCOUNTING_LAYER.md](./ACCOUNTING_LAYER.md).

## Current Integration Boundaries

- External wallet connection is integrated with Arc Testnet.
- External ERC-20 USDC balance reading is integrated.
- Manual external-wallet-to-Treasury ERC-20 transfer is integrated through the payment boundary.
- Independent external-wallet-to-escrow `approve -> deposit` is integrated through the payment boundary.
- Business Profile, advertisements, auction state, internal balance, and auction payments remain demo-only.
- `AuctionEscrow` deposit is integrated with the frontend, payment service, and wallet transaction flow.
- Operator settlement is handled by `/api/operator/process`.
