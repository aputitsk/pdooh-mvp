## Current Session

### Added

- Money layer in `lib/money/usdc.ts`.
- `UsdcMinorUnits` representation for USDC values.
- Minor-unit storage keys for advertiser balance and demo treasury.
- Aggregate bid exposure lock for auction bid placement.
- Modular developer reset lifecycle.

### Changed

- Balance, bids, payments, demo treasury, and winner bid amounts now use minor units internally.
- USDC display is formatted through the money layer.
- USDC user input is parsed through the money layer.
- Legacy decimal storage keys are maintained only as migration/display mirrors.
- Auction logic is organized under `lib/auction`.
- Wallet logic is isolated under `lib/wallet`.
- Offline production build no longer depends on Google Fonts.
- Internal documentation synchronized with the current code.

### Verified

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
