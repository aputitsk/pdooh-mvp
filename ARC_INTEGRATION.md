# pDOOH Arc Integration

Status: Partially integrated with Arc Testnet

## Current Status

The project has an active Arc Testnet integration for:

- connecting an injected external wallet;
- Arc Testnet network handling;
- reading the connected wallet's ERC-20 USDC balance;
- manually transferring ERC-20 USDC from the connected wallet to the configured pDOOH Treasury address;
- independently approving and depositing ERC-20 USDC into the configured `AuctionEscrow`.

The Business Profile, advertisements, internal demo balance, auction state, winner selection, paid-slot state, and demo treasury remain browser-based demo features.

Operator settlement is enabled through the Vercel API route at `/api/operator/process`. The advertiser signs an EIP-712 Bid Authorization at Place Bid; settlement after playback remains automatic and requires no wallet popup after winning.

## Integrated Arc and Circle Surface

The project currently integrates the following Arc/Circle-related surfaces:

- Arc Testnet network configuration, including chain ID, RPC URL, native USDC symbol, and ArcScan explorer metadata.
- Injected external wallet connection for MetaMask/Rabby-style browser wallets, including EIP-6963 discovery, `window.ethereum` fallback, Arc Testnet switching, and local session restoration.
- Circle Viem adapter initialization through `@circle-fin/adapter-viem-v2` after a browser wallet provider is selected.
- Read-only ERC-20 USDC balance reads for the connected Arc Testnet wallet.
- Manual ERC-20 USDC Treasury transfer through the wallet transaction layer and Arc transaction adapter.
- Independent `AuctionEscrow` ERC-20 USDC `approve -> deposit`, `withdraw`, and operator `settle` paths.
- EIP-712 Bid Authorization at bid time, so settlement after playback can be submitted by the server-side Operator without another advertiser wallet popup.
- Server-side operator settlement through `/api/operator/process`, using `OPERATOR_PRIVATE_KEY` as a server-only Vercel environment variable.
- Settlement memo metadata generation and submission through the Arc Memo contract during operator settlement.
- ArcScan UI links for wallet, escrow, settlement, and escrow transaction references where hashes or addresses are already available.
- Copy actions for relevant wallet addresses, contract addresses, transaction hashes, and settlement identifiers.
- Arc Testnet fee signal UI based on client-side Arc gas-price reads, without polling or backend API routes.
- Circle Faucet external link for obtaining Test USDC on Arc Testnet.

The project does not currently integrate:

- Circle App Kit Swap execution or quote APIs;
- `@circle-fin/app-kit` or `@circle-fin/swap-kit`;
- Circle User-Controlled Wallet or email/social wallet login;
- Circle CCTP, bridging, or cross-chain funding;
- a dedicated `/fund` route, funding page shell, or swap preview UI;
- any custom backend quote, swap, gas polling, or Circle Wallet service.

## Arc Testnet Configuration

The active Arc integration uses:

- network: Arc Testnet;
- chain ID: `5042002`;
- RPC URL: `https://rpc.testnet.arc.network`;
- block explorer: `https://testnet.arcscan.app`;
- native currency symbol: USDC;
- ERC-20 USDC interface: `0x3600000000000000000000000000000000000000`.

Arc uses native USDC for gas with 18 decimals of precision. The standard ERC-20 USDC interface used by the application has 6 decimals. Application token amounts must not mix the native gas representation with the ERC-20 representation.

## Arc Wallet Integration

`lib/arc/arcWalletAdapter.ts` contains the active external wallet implementation.

The current wallet flow:

1. Discovers injected wallets through EIP-6963.
2. Uses `window.ethereum` as a fallback when no EIP-6963 provider is announced.
3. Requests account access from the selected provider.
4. Switches the wallet to Arc Testnet.
5. Adds Arc Testnet through the wallet provider when the chain is unknown.
6. Requests the existing pDOOH sign-in signature.
7. Initializes the Circle Viem adapter from the selected provider.
8. Stores the active provider and tracks account and chain changes.

The application also attempts to restore an already authorized browser-wallet session. Application disconnect is local to the pDOOH browser session and does not revoke permissions inside the external wallet.

The runtime UI accesses wallet behavior through the public `lib/wallet` facade rather than importing `arcWalletAdapter.ts` directly.

## Arc Testnet Network Handling

The wallet adapter uses the provider methods `wallet_switchEthereumChain` and `wallet_addEthereumChain` with the configured Arc Testnet parameters.

Balance reads and transaction execution verify the Arc Testnet chain ID. A connected wallet on another chain is not treated as ready for Arc balance or transfer operations.

Public Arc reads use a Viem public client configured with the Arc Testnet RPC endpoint.

## Read-only ERC-20 USDC Balance

`lib/arc/arcBalanceAdapter.ts` reads the connected external wallet's USDC balance through the standard ERC-20 `balanceOf` interface.

The balance operation:

- validates the wallet address;
- reads from the Arc Testnet ERC-20 USDC interface;
- converts the 6-decimal token amount to the project's `UsdcMinorUnits` representation;
- rejects values outside the safe JavaScript integer range;
- does not submit a transaction or request a wallet signature.

The external Arc USDC balance is distinct from the internal demo balance stored in the browser.

## Manual ERC-20 Treasury Transfer

The Advertiser page contains a manual action for transferring ERC-20 USDC from the connected external wallet to the configured pDOOH Treasury address.

The current implementation uses Viem and the standard ERC-20 `transfer` function. It:

1. parses the entered amount into 6-decimal USDC minor units;
2. verifies the connected account and Arc Testnet chain;
3. simulates the ERC-20 `transfer`;
4. requests transaction submission from the selected browser wallet;
5. waits for the transaction receipt;
6. reports success only when the receipt status is successful.

This transaction is a standalone wallet-to-Treasury transfer. It is not an escrow deposit, auction settlement, or automatic payment triggered by auction playback.

## App Kit Status

App Kit Send is not implemented.

The project does not include `@circle-fin/app-kit` and does not call `AppKit`, `estimateSend`, or `kit.send()`. The installed `@circle-fin/adapter-viem-v2` package is used to initialize a Viem adapter during wallet connection, but the current Treasury transfer is executed directly through Viem and the ERC-20 `transfer` interface.

The manual Treasury transfer must therefore not be described as App Kit Send.

## Payment Service Boundary

The runtime payment path is:

`TreasuryTransferCard` → `lib/payments/paymentService.ts` → `lib/wallet/walletTransactions.ts` → `lib/arc/arcTransactionAdapter.ts`

The UI does not import the Arc transaction adapter or Viem directly.

Responsibilities are separated as follows:

- UI: collects the amount and displays lifecycle state.
- `paymentService`: exposes manual Treasury transfer and independent escrow deposit operations to the UI.
- wallet transaction layer: parses the amount and coordinates transaction lifecycle callbacks.
- Arc transaction adapters: perform Arc-specific account, chain, contract validation, simulation, submission, and receipt handling.

This payment boundary is not used by the demo auction payment logic.

## Arc Adapter Boundary

`lib/arc` contains:

- `arcConstants.ts`: Arc Testnet network and ERC-20 USDC constants;
- `arcConfig.ts`: public Treasury address validation;
- `arcWalletAdapter.ts`: injected wallet and Arc network handling;
- `arcBalanceAdapter.ts`: read-only ERC-20 USDC balance access;
- `arcTransactionAdapter.ts`: manual ERC-20 Treasury transfer execution;
- `arcEscrowConfig.ts`: public escrow address validation;
- `arcEscrowAdapter.ts`: configured escrow validation and independent `approve -> deposit` execution;
- `arcPorts.ts`: Arc-facing wallet, balance, and payment type contracts;

Arc-specific provider and Viem behavior is kept outside the demo advertiser, advertisement, and auction modules.

## Demo Auction and Blockchain Separation

The demo auction operates entirely through browser state:

- bids and selected advertisements are stored in `localStorage`;
- winners are selected by demo auction logic;
- paid slots are browser-state markers;
- winning user amounts are subtracted from the internal demo balance;
- the same amounts are added to the demo treasury.

This flow does not:

- read the external wallet's Arc USDC balance for auction eligibility;
- ask the advertiser wallet to submit a transaction after winning;
- call `paymentService`;
- call `AuctionEscrow` directly from browser auction code.

The manual external-wallet Treasury transfer is displayed in the advertiser flow but is not connected to auction state or auction payment processing.

## AuctionEscrow Status

`src/AuctionEscrow.sol` and Solidity test sources are present in the repository. The frontend can independently approve ERC-20 USDC and call `deposit(amount)` through the payment service, wallet transaction layer, and Arc escrow adapter.

The demo auction does not import or call `AuctionEscrow`. Settlement uses `/api/operator/process`, which verifies bid authorization before using `OPERATOR_PRIVATE_KEY`.

The escrow is exclusively a financial boundary:

- advertiser escrow balances are keyed by advertiser public address;
- deposits credit only the caller;
- withdrawals return funds only to the caller;
- only the Operator may settle an advertiser balance to Treasury;
- replay protection is keyed by `settlementId`;
- `settlementId` is the only pDOOH domain-layer identifier accepted or stored by the escrow.

Screen, slot, advertisement, campaign, auction, and Business Profile identifiers are not part of the escrow interface or storage.

## ERC-20 Escrow Flow

The escrow uses the standard ERC-20 USDC flow:

`approve → transferFrom → transfer`

1. The advertiser grants the escrow an ERC-20 USDC allowance through `approve`.
2. `deposit` receives USDC through `transferFrom`.
3. `withdraw` transfers USDC back to the advertiser, or `settle` transfers USDC to Treasury, through `transfer`.

The escrow does not use Arc native USDC value transfer. Its token operations use the 6-decimal ERC-20 USDC interface.

## Escrow Roles

The escrow uses three distinct public addresses:

- Owner: controls changes to the Operator address through the ownership mechanism.
- Operator: may call `settle`.
- Treasury: immutable recipient of settled USDC.

The deployment script requires Owner, Operator, and Treasury to be different addresses. It also requires the frontend Treasury configuration to match the escrow Treasury configuration.

Vercel must store `OPERATOR_PRIVATE_KEY` only as a server-side environment variable.

## Accounting Boundary

The project uses an Accounting Layer between finalized auction results and the server-side operator route.

Accounting records the financial obligation and off-chain reservation. Escrow continues to provide custody and receives only `advertiser`, `amount`, and `settlementId` during settlement. Treasury remains the settlement destination.

Escrow custody must not be described as auction balance. The detailed planned model and lifecycle are documented in [ACCOUNTING_LAYER.md](./ACCOUNTING_LAYER.md).

## Official Arc References

- [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc)
- [Arc Testnet contract addresses](https://docs.arc.io/arc/references/contract-addresses)
- [Arc EVM differences](https://docs.arc.io/arc/references/evm-differences)
- [App Kit Send quickstart](https://docs.arc.io/app-kit/quickstarts/send-tokens-same-chain)
