# pDOOH MVP Architecture

Status: Current demo MVP

## Structure

- `app/` contains pages and route-level containers.
- `components/` contains UI components.
- `lib/` contains business logic and browser-storage modules.

## Pages

- `app/page.tsx`: Home.
- `app/advertiser/page.tsx`: Advertiser Dashboard and Business Profile flow.
- `app/advertisements/page.tsx`: Advertisement management.
- `app/screen/page.tsx`: auction screen and live playback.
- `app/layout.tsx`: shared RootLayout and Navbar.

## Component Areas

- `components/layout`: shared Navbar and WalletButton.
- `components/advertiser`: Advertiser Dashboard cards.
- `components/advertisements`: advertisement workspace UI.
- `components/auction`: auction UI, slot cards, bid inputs, live screen.

## Business Logic

- `lib/advertiser`: Business Profile state, Business Name, advertiser balance storage, and demo advertiser store.
- `lib/advertisements`: Advertisement types, storage, demo/default advertisement logic, create/delete rules.
- `lib/auction`: auction clock, timer, slot state, bidding actions, winner selection, payments, storage, and demo auction store.
- `lib/wallet`: mock wallet state, wallet storage, wallet events, wallet hook, connect/logout/reset facade.
- `lib/money/usdc.ts`: USDC parser, formatter, constants, and `UsdcMinorUnits`.
- `lib/arc`: directory exists, but no Arc adapter implementation is present yet.

## State and Storage

The current MVP uses React client hooks plus `localStorage` synchronization.

Main storage ownership:

- Wallet: `pdooh-wallet-connected`, `pdooh-wallet-address`.
- Advertiser: `pdooh-business-name`, `pdooh-business-profile-created`, `pdooh-balance`, `pdooh-balance-minor-units`.
- Advertisements: `pdooh-ads`.
- Auction: `pdooh-auction-*`, `pdooh-demo-treasury`, `pdooh-demo-treasury-minor-units`.

## Money Rules

- All internal USDC math uses `UsdcMinorUnits`.
- Inputs are parsed through `parseUSDCToMinorUnits`.
- UI output is formatted through `formatUSDCFromMinorUnits`.
- Legacy decimal string keys are migration/display mirrors when minor-unit keys are written.
- Auction payments move winning user bid amounts from wallet balance to demo treasury.
- Aggregate exposure lock prevents placing bids when total slot exposure exceeds wallet balance.

## Reset Lifecycle

Developer reset is modular:

- `resetWallet()` clears wallet connected state and wallet address.
- `resetStoredAdvertiser()` clears Business Profile, Business Name, and advertiser balance keys.
- `resetStoredAdvertisements()` clears only advertisement storage.
- `resetDemoAuctionStore()` clears auction demo storage and emits auction store changes.

## Arc Readiness

The architecture is prepared for a future Arc adapter boundary. Arc SDK, Arc wallet, Arc payments, and Arc balance implementations are not connected in the current code.
