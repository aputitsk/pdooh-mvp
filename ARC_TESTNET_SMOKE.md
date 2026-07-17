# Arc Testnet Contract Auction Smoke

Status: runbook plus observed Arc Testnet smoke results. Do not run deployment commands unless you explicitly intend to deploy.

This smoke flow validates the new `AuctionEscrowV2` + `AuctionEngineV1` path on Arc Testnet without switching the frontend and without touching legacy `AuctionEscrow`.

Observed Arc Testnet smoke coverage:

- paid winner -> playback -> settlement;
- proof expiry -> reservation release;
- threshold `0.02` -> `NO_PAID_WINNER` + release.

## Environment Checklist

Public/config values:

- `ARC_TESTNET_USDC=0x3600000000000000000000000000000000000000`
- `PDOOH_ADMIN`
- `PDOOH_CONFIG_ADMIN`
- `PDOOH_REPORTER`
- `PDOOH_PAUSER`
- `PDOOH_TREASURY`
- `PDOOH_INITIAL_SITE_ID`
- `PDOOH_FIRST_CYCLE_START`
- `PDOOH_PROOF_DEADLINE_SECONDS=60`

After deployment:

- `PDOOH_AUCTION_ESCROW_V2`
- `PDOOH_AUCTION_ENGINE_V1`

Smoke values:

- `PDOOH_SMOKE_SITE_ID` should equal `PDOOH_INITIAL_SITE_ID`
- `PDOOH_SMOKE_CYCLE_ID=0`
- `PDOOH_SMOKE_SLOT_INDEX=0`
- `PDOOH_SMOKE_ADVERTISER`
- `PDOOH_SMOKE_ADVERTISEMENT_ID`
- `PDOOH_SMOKE_SCREEN_ID`
- `PDOOH_SMOKE_EVIDENCE_HASH`
- `PDOOH_SMOKE_BID_AMOUNT=30000`
- `PDOOH_SMOKE_REPORTER_NONCE=1`

Private keys should stay in your shell, password manager, or CI secret store. Do not commit them.

## Timing

Initial V1 timing is:

- open: 60 seconds
- locked: 2 seconds
- slot 0 playback: 10 seconds
- proof deadline: `PDOOH_PROOF_DEADLINE_SECONDS`

For cycle `0`, using `PDOOH_FIRST_CYCLE_START = T`:

- bid during `[T, T + 60)`
- finalize after `T + 60`
- confirm slot 0 after `T + 72` and before `T + 72 + PDOOH_PROOF_DEADLINE_SECONDS`
- settle any time after confirm

Set `PDOOH_FIRST_CYCLE_START` a few minutes in the future before configuring the site.

## Commands

Use Arc Testnet RPC from `foundry.toml`:

```powershell
forge script script/DeployAuctionEngineV1.s.sol:DeployAuctionEngineV1 --rpc-url arc_testnet --broadcast --private-key $env:PDOOH_ADMIN_PRIVATE_KEY
```

Save the deployed addresses into:

```powershell
$env:PDOOH_AUCTION_ESCROW_V2="0x..."
$env:PDOOH_AUCTION_ENGINE_V1="0x..."
```

Configure the initial smoke site with the config-admin key:

```powershell
forge script script/ConfigureAuctionEngineV1Site.s.sol:ConfigureAuctionEngineV1Site --rpc-url arc_testnet --broadcast --private-key $env:PDOOH_CONFIG_ADMIN_PRIVATE_KEY
```

During the open window, bid with the advertiser key:

```powershell
forge script script/SmokeAuctionEngineV1.s.sol:SmokeAuctionEngineV1Bid --rpc-url arc_testnet --broadcast --private-key $env:PDOOH_SMOKE_ADVERTISER_PRIVATE_KEY
```

If Foundry local simulation fails inside Arc USDC system/blocklist calls, use `--skip-simulation` for bid and settlement. The local fork cannot always reproduce Arc-specific USDC behavior.

Observed on Arc Testnet: even `--skip-simulation` still executes the Solidity script locally to collect transactions, so scripts that call USDC `transferFrom` may fail before broadcast. In that case, send the USDC-touching steps as raw transactions with `cast send --gas-limit`:

```powershell
cast send $env:ARC_TESTNET_USDC "approve(address,uint256)" $env:PDOOH_AUCTION_ESCROW_V2 $env:PDOOH_SMOKE_BID_AMOUNT --rpc-url https://rpc.testnet.arc.network --private-key $env:PDOOH_SMOKE_ADVERTISER_PRIVATE_KEY --gas-limit 200000

cast send $env:PDOOH_AUCTION_ESCROW_V2 "deposit(uint256)" $env:PDOOH_SMOKE_BID_AMOUNT --rpc-url https://rpc.testnet.arc.network --private-key $env:PDOOH_SMOKE_ADVERTISER_PRIVATE_KEY --gas-limit 500000

cast send $env:PDOOH_AUCTION_ENGINE_V1 "placeBid(bytes32,uint64,uint8,bytes32,uint256)" $env:PDOOH_SMOKE_SITE_ID $env:PDOOH_SMOKE_CYCLE_ID $env:PDOOH_SMOKE_SLOT_INDEX $env:PDOOH_SMOKE_ADVERTISEMENT_ID $env:PDOOH_SMOKE_BID_AMOUNT --rpc-url https://rpc.testnet.arc.network --private-key $env:PDOOH_SMOKE_ADVERTISER_PRIVATE_KEY --gas-limit 800000

cast send $env:PDOOH_AUCTION_ENGINE_V1 "finalizeSlot(bytes32,uint64,uint8)" $env:PDOOH_SMOKE_SITE_ID $env:PDOOH_SMOKE_CYCLE_ID $env:PDOOH_SMOKE_SLOT_INDEX --rpc-url https://rpc.testnet.arc.network --private-key $env:PDOOH_RELAYER_PRIVATE_KEY --gas-limit 500000

cast send $env:PDOOH_AUCTION_ENGINE_V1 "settleSlot(bytes32,uint64,uint8)" $env:PDOOH_SMOKE_SITE_ID $env:PDOOH_SMOKE_CYCLE_ID $env:PDOOH_SMOKE_SLOT_INDEX --rpc-url https://rpc.testnet.arc.network --private-key $env:PDOOH_RELAYER_PRIVATE_KEY --gas-limit 600000
```

After open closes, finalize the slot. Any funded sender can relay this:

```powershell
forge script script/SmokeAuctionEngineV1.s.sol:SmokeAuctionEngineV1Finalize --rpc-url arc_testnet --broadcast --private-key $env:PDOOH_RELAYER_PRIVATE_KEY
```

After playback ends and before the proof deadline, confirm with the reporter key:

```powershell
forge script script/SmokeAuctionEngineV1.s.sol:SmokeAuctionEngineV1Confirm --rpc-url arc_testnet --broadcast --private-key $env:PDOOH_REPORTER_PRIVATE_KEY
```

After confirmation, settle. Any funded sender can relay this:

```powershell
forge script script/SmokeAuctionEngineV1.s.sol:SmokeAuctionEngineV1Settle --rpc-url arc_testnet --broadcast --private-key $env:PDOOH_RELAYER_PRIVATE_KEY
```

To test expiry instead of settlement, skip confirmation and run this after the proof deadline:

```powershell
forge script script/SmokeAuctionEngineV1.s.sol:SmokeAuctionEngineV1Expire --rpc-url arc_testnet --broadcast --private-key $env:PDOOH_RELAYER_PRIVATE_KEY
```

## Expected Results

- `DeployAuctionEngineV1` deploys V2 escrow and engine, then binds the engine once with `setEngine`.
- `ConfigureAuctionEngineV1Site` creates the initial `SiteConfig` only for the configured `bytes32 siteId`.
- `SmokeAuctionEngineV1Bid` approves/deposits only the missing USDC amount, then places one paid bid.
- `SmokeAuctionEngineV1Finalize` finalizes slot 0 as `PAID_WINNER`.
- `SmokeAuctionEngineV1Confirm` moves the slot to `PLAYED`.
- `SmokeAuctionEngineV1Settle` moves the slot to `SETTLED` and transfers ERC-20 USDC to Treasury.
- `SmokeAuctionEngineV1Expire` moves the slot to `EXPIRED` and releases the reservation.

## Safety Notes

- Do not reuse a site/cycle/slot between legacy and contract paths.
- Do not switch frontend mode mid-cycle.
- The smoke scripts use only ERC-20 USDC calls; there is no `msg.value` flow.
- The advertiser key must hold enough Arc native gas and ERC-20 Test USDC.
- Keep a native gas buffer; do not deposit the full underlying wallet balance.
