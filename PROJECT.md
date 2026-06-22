# pDOOH MVP

Status: Current demo MVP

## Purpose

pDOOH is a demo private DOOH advertising marketplace. The current app runs on mock browser storage and is prepared for a later Arc implementation layer without changing the main UX.

## Current State

- Demo flow works: Home -> Advertiser -> Advertisements -> Screen.
- `npm run lint` passes.
- `npx tsc --noEmit` passes.
- `npm run build` passes.
- Offline build no longer depends on Google Fonts; the app uses local system fonts from CSS.

## Product Flow

1. Connect Wallet from the Navbar.
2. Create a Business Profile with a Business Name.
3. Deposit Test USDC into the internal demo balance.
4. Manage Advertisements.
5. Bid for screen slots on the auction screen.

## Implemented Demo Features

- Home page.
- Advertiser Dashboard.
- Business Profile creation.
- Automatic Demo Advertisement after first Business Profile creation.
- Advertisements workspace with create, delete, duplicate protection, sorting, and storage sync.
- Mock wallet connection, logout, and reset.
- Internal demo balance.
- Hidden slot bidding.
- Demo Bot with a fixed 0.02 USDC bid.
- Winner selection and demo payments.
- Developer reset for demo state.

## Money Model

- USDC values are represented as `UsdcMinorUnits`.
- Balance, bids, payments, treasury, and winner bid amounts use minor units internally.
- Display values are formatted with `formatUSDCFromMinorUnits`.
- User input is parsed with `parseUSDCToMinorUnits`.
- Legacy display keys such as `pdooh-balance` and `pdooh-demo-treasury` are kept as migration/display mirrors beside minor-unit keys.
- Aggregate bid exposure is locked: total entered bids cannot exceed the demo wallet balance when placing a bid.

## Arc Status

Arc is not integrated yet. The current code uses mock wallet, mock storage, mock balance, and mock payments.

Next Arc step: create an Arc adapter boundary, then replace mock wallet, mock payments, and mock balance implementations with Arc-compatible modules.
