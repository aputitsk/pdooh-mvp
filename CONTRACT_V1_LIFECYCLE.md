# Contract V1 Lifecycle Architecture

This document designs the Contract V1 lifecycle orchestration boundary. It does
not wire runtime routes, cron jobs, workers, frontend buttons, wallet adapters,
or production automation.

## Scope

Contract V1 lifecycle actions:

- `snapshotCycle`
- `finalizeSlot`
- `confirmPlayback`
- `settleSlot`
- `expireSlot`

The goal is to keep the current product timing and UX while moving auction
authority to `AuctionEngineV1` and `AuctionEscrowV2`. Browser heartbeat,
localStorage, Redis, and legacy `/api/operator/process` must not be authority in
contract mode.

Current Contract V1 app code is read-only. The read ABI under
`lib/arc/contractV1/abi.ts` intentionally exposes diagnostics reads only, not
write methods.

## 1. Factual Lifecycle API

### `snapshotCycle(bytes32 siteId, uint64 cycleId)`

Facts:

- Explicit call is optional. `placeBid`, `finalizeSlot`, `confirmPlayback`,
  `expireSlot`, and `settleSlot` all call `snapshotCycle` internally.
- Any account can call it. There is no role gate.
- It can be called only after the target cycle start. Before that it reverts
  with `CycleNotStarted`.
- If nobody calls it, `getCycleSnapshot` returns an empty non-existing snapshot,
  while `previewCycle` can still compute the expected cycle from site config.
- It can be created late. There is no upper timestamp bound.
- It is state-idempotent. A repeated call returns the existing persisted
  snapshot and does not emit another `CycleSnapshotCreated`.
- `previewCycle` is a view call and does not persist state.
- Any lifecycle write that calls `snapshotCycle` can create the persisted
  snapshot as a side effect. Direct readers that require immutable persisted
  values should check `snapshot.exists`.

### `finalizeSlot(bytes32 siteId, uint64 cycleId, uint8 slotIndex)`

Facts:

- Permissionless. There is no role gate.
- Earliest timestamp is `snapshot.openEndsAt`, which is `t=60` with the current
  `60s/2s/3x10s` config.
- There is no latest timestamp. It can be called after playback starts, after
  playback ends, and after the proof deadline, as long as the slot is still
  `UNFINALIZED`.
- It creates the cycle snapshot if needed.
- It scans at most `MAX_BIDS_PER_SLOT = 10` bid ids.
- If the highest bid is strictly greater than `snapshot.minimumPaidBid`, the
  slot becomes `PAID_WINNER`; the winning reservation stays reserved and losing
  reservations are released.
- If there is no paid winner, including the `highestAmount <= minimumPaidBid`
  path, the slot becomes `NO_PAID_WINNER` and all reservations for the slot are
  released.
- A repeated call after any finalized outcome reverts with
  `SlotAlreadyFinalized`.
- A missed finalize can be safely recovered late by a state-aware caller. If it
  is recovered after the proof deadline and produces `PAID_WINNER`, `expireSlot`
  can release the reservation immediately afterward.

### `confirmPlayback(PlaybackReport report)`

Facts:

- Role-gated by `REPORTER_ROLE`.
- The transaction sender is the authorized reporter. The report has no embedded
  ECDSA signature checked by the contract.
- Report fields:
  - `siteId`
  - `cycleId`
  - `slotIndex`
  - `advertisementId`
  - `screenId`
  - `playbackStartedAt`
  - `playbackEndedAt`
  - `reporterNonce`
  - `success`
  - `evidenceHash`
- Guard rails:
  - `siteId`, `advertisementId`, and `screenId` must be nonzero.
  - `reporterNonce` is single-use per reporter address.
  - The cycle snapshot is created if needed.
  - Slot must currently be `PAID_WINNER`.
  - `success` must be true.
  - `playbackEndedAt >= playbackStartedAt`.
  - `block.timestamp >= playbackEndedAt`.
  - `report.advertisementId == slot.advertisementId`.
  - `block.timestamp <= slotProofDeadline`.
  - `playbackStartedAt >= slotStart`.
  - `playbackEndedAt <= slotEnd`.
- It does not require `playbackEndedAt == slotEnd`.
- It does not require the full ten-second slot window to elapse.
- A trusted reporter can confirm at `slotStart + 4s` with
  `playbackStartedAt = slotStart` and `playbackEndedAt = slotStart + 4s`.
- The deterministic `playbackReportDigest` binds the report fields through
  `AuctionIds.playbackReportDigest`.
- A duplicate with the same reporter nonce reverts with
  `PlaybackReportAlreadyUsed`. A later confirmation attempt with a different
  nonce reverts because the slot is no longer `PAID_WINNER`.
- Current demo security is a trusted reporter model. A future oracle, APS, or
  private execution layer can replace the reporter without changing browser
  authority.

### `settleSlot(bytes32 siteId, uint64 cycleId, uint8 slotIndex)`

Facts:

- Permissionless. There is no role gate.
- Preconditions:
  - valid configured site and slot;
  - cycle snapshot can be created or already exists;
  - slot outcome is `PLAYED`.
- Earliest timestamp is immediately after successful `confirmPlayback`. With a
  four-second playback report, settlement can happen at `slotStart + 4s`.
- There is no latest timestamp.
- It computes settlement id as `AuctionIds.settlementId(slotKey, paidWinner,
  advertisementId)`.
- It calls `AuctionEscrowV2.settleReservation` for the winning reservation and
  exact paid amount.
- On success, the slot becomes `SETTLED`, `slot.settlementId` is written, the
  reservation is released, the advertiser balance is reduced by the paid amount,
  and the treasury receives USDC.
- A duplicate call after success reverts with `SlotNotPlayed`; integration must
  reread `getSlotState` and treat `SETTLED` as already completed.
- If the USDC transfer fails, the whole transaction reverts and the slot remains
  `PLAYED` with an active reservation. A later retry can settle.
- Already-settled state is determined by `getSlotState(...).outcome == SETTLED`
  and nonzero `settlementId`. Escrow also exposes `processedSettlement`.

### `expireSlot(bytes32 siteId, uint64 cycleId, uint8 slotIndex)`

Facts:

- Permissionless. There is no role gate.
- Preconditions:
  - valid configured site and slot;
  - cycle snapshot can be created or already exists;
  - slot outcome is `PAID_WINNER`.
- Earliest timestamp is strictly after `_slotProofDeadline`; equality is not
  enough.
- It releases the winning reservation and marks the slot `EXPIRED`.
- It cannot run after confirmation because the slot is `PLAYED`.
- It cannot run after settlement because the slot is `SETTLED`.
- A duplicate call after expiry reverts with `SlotHasNoPaidWinner`; integration
  must reread state and treat `EXPIRED` as already terminal.
- A missed expiry can be recovered late.

## 2. Lifecycle State Machine

Do not invent new contract states. The only slot enum is:

| Value | Enum |
| --- | --- |
| 0 | `UNFINALIZED` |
| 1 | `PAID_WINNER` |
| 2 | `NO_PAID_WINNER` |
| 3 | `PLAYED` |
| 4 | `EXPIRED` |
| 5 | `SETTLED` |

| State | Incoming | Outgoing | Timestamp guard | Auth | Engine side effects | Escrow side effects | Events | Terminal | Retry semantics |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Unsnapshotted | Site configured, cycle not persisted | `snapshotCycle` side effect or explicit call | `now >= startsAt` | Any caller | Persist immutable cycle fields | None | `CycleSnapshotCreated` | No | Repeated call returns existing snapshot |
| Open / `UNFINALIZED` | Snapshot exists or previewed; bids may exist | `placeBid`, then later `finalizeSlot` | `startsAt <= now < openEndsAt` for bids | Bidder for bid; any for snapshot | Bid stored; slot remains `UNFINALIZED` | Reservation created on bid | `BidPlaced`, `Reserved` | No | Duplicate same bidder/slot reverts |
| Locked or live / `UNFINALIZED` | Open ended | `finalizeSlot` | `now >= openEndsAt` | Any caller | Winner or no-paid outcome written | Losers released, or all released for no-paid | `SlotFinalized`, `ReservationReleased` | No | Repeated finalize reverts; reread outcome |
| `NO_PAID_WINNER` | `finalizeSlot` with no bid above threshold | None | None | None | Outcome only | All slot reservations released | `SlotFinalized` | Yes | Treat as completed terminal |
| `PAID_WINNER` | `finalizeSlot` with highest bid above threshold | `confirmPlayback` or `expireSlot` | Confirm before/equal proof deadline; expire after deadline | Reporter for confirm; any for expire | Winner fields fixed | Winning reservation remains active until played/expired | `SlotFinalized` | No | Reread before write; stale actions revert |
| `PLAYED` | `confirmPlayback` | `settleSlot` | None after confirmation | Any caller | Playback digest stored | Reservation still active | `PlaybackConfirmed` | No | Settlement retry is safe after failed tx |
| `SETTLED` | `settleSlot` | None | None | None | Settlement id stored | Reservation settled; final amount charged | `ReservationSettled`, `SlotSettled` | Yes | Duplicate settle reverts; reread and classify already completed |
| `EXPIRED` | `expireSlot` | None | `now > slotProofDeadline` | None | Outcome updated | Reservation released | `ReservationReleased`, `SlotExpired` | Yes | Duplicate expire reverts; reread and classify already completed |

## 3. Responsibility Split

### A. Permissionless Automation

Candidates: `snapshotCycle`, `finalizeSlot`, `settleSlot`, `expireSlot`.

| Action | Safe for anyone | Privileged key needed | Low-value wallet ok | Gas payer | Griefing / concurrency | Locking |
| --- | --- | --- | --- | --- | --- | --- |
| `snapshotCycle` | Yes | No | Yes | Caller | Repeated calls after snapshot do nothing harmful | State-before-write is enough |
| `finalizeSlot` | Yes | No | Yes | Caller | Racing calls produce one success and stale reverts | Optional lock only saves gas |
| `settleSlot` | Yes after `PLAYED` | No | Yes | Caller | Racing calls produce one success and stale reverts | Optional lock only saves gas |
| `expireSlot` | Yes after deadline | No | Yes | Caller | Racing calls produce one success and stale reverts | Optional lock only saves gas |

Distributed locks and leader election are optimization only. Correctness must
come from reading contract state before writing and rereading after receipt or
timeout.

### B. Trusted Reporter

Only playback proof belongs here.

Rules:

- Do not reuse the legacy `OPERATOR_PRIVATE_KEY` as reporter.
- Do not place the reporter key in frontend, `NEXT_PUBLIC_*`, localStorage, or
  any browser-delivered bundle.
- Do not expose an unauthenticated public route that signs or submits reporter
  transactions.
- Do not mix reporter authority with legacy `/api/operator/process`.
- The reporter receives minimum data: site id, cycle id, slot index, expected
  winner advertisement id, screen id, observed playback start/end, success flag,
  evidence hash, and a reporter nonce.
- The reporter must verify that the display evidence corresponds to the
  expected site/cycle/slot/ad before submitting.
- Current trust assumption: the reporter is a trusted off-chain service that
  attests real playback. The contract checks authorization, timing, nonce,
  ad identity, and slot state; it does not verify the media evidence itself.
- Future replacement path: APS/oracle/private execution can produce the same
  report fields or a stronger proof, while the browser remains non-authoritative.
- Report creation and on-chain submission can be split later, but the current
  contract only authorizes the transaction sender via `REPORTER_ROLE`.

### C. Projection And Indexing

Authority:

- Contract reads and events are authority for cycle, slot outcome, paid winner,
  reservation, settlement id, and balances.
- Redis can only be cache/projection after receipt or event ingestion.
- localStorage can only hold user UI affordances such as drafts, not winner,
  settlement amount, or reservation authority.

Events to ingest:

- `CycleSnapshotCreated`
- `BidPlaced`
- `SlotFinalized`
- `PlaybackConfirmed`
- `SlotExpired`
- `SlotSettled`
- `Reserved`
- `ReservationReleased`
- `ReservationSettled`
- `Deposited`
- `Withdrawn`

Direct reads needed for recovery:

- `currentCycleId`
- `previewCycle`
- `getCycleSnapshot`
- `getSlotState`
- `getSlotBidCount`
- `balanceOf`
- `availableOf`
- `reservedOf`
- `getReservation`
- `processedSettlement`

Redis rebuild after full deletion:

1. Load configured site ids and deployment addresses.
2. Determine current and recent cycle ids from `currentCycleId` and site config.
3. Read `getCycleSnapshot` and `previewCycle` for each relevant cycle.
4. Read every slot state.
5. Backfill events for bid, finalization, playback, settlement, expiry,
   deposit, withdraw, reserve, and release.
6. Recompute LatestSettlementCard and account revenue projection from settled
   contract outcomes, not from legacy settlement records.

LatestSettlementCard should be a projection of `SlotSettled` plus slot state.
Revenue projection should use `SlotSettled` / `ReservationSettled` and
`settlementId` for idempotency.

## 4. Deployment Architecture Options

| Option | Fit | Strengths | Weaknesses | Reporter suitability |
| --- | --- | --- | --- | --- |
| Vercel Cron + server routes | Useful only for coarse permissionless catch-up | Low app ops, can scan and recover late finalization/expiry/settlement | Not a reliable sub-10-second scheduler for `t=66/76/86`; cold starts/timeouts/concurrency can miss short windows | Not recommended for reporter key or proof authority |
| External keeper worker | Best demo fit for short cycles | Always-on polling, can react around `t=60/66/76/86`, clear retry loop, private env outside frontend | Requires a small service, monitoring, RPC management, gas funding | Acceptable if reporter key is isolated and route is not public |
| Third-party automation | Conceptually good for permissionless calls | Outsourced scheduling, monitoring, retries | Must verify Arc support, cost, latency, key custody, observability | Reporter role requires careful custody; do not assume support |
| Hybrid | Best long-term shape | Permissionless calls can be public/keeper; reporter is separate; projection is event-driven; UI can be opportunistic recovery only | More components to operate | Best separation when reporter is a dedicated service |

Do not use a browser heartbeat to cover timing gaps. If the chosen automation
cannot hit the short windows, use a dedicated worker or accept documented late
settlement behavior only after product approval.

## 5. Recommended Architecture

### Demo Stage

Use a hybrid-lite external worker:

- Vercel app remains UI/read/projection only.
- A separate worker process polls Arc Testnet every 1-2 seconds for configured
  sites and current/recent cycles.
- The worker uses a low-value permissionless wallet for `snapshotCycle`,
  `finalizeSlot`, `settleSlot`, and `expireSlot`.
- The reporter role is held by a separate key or isolated module inside the
  worker environment, not by the frontend and not by a public route.
- The worker confirms playback around:
  - slot 1: `t=66`
  - slot 2: `t=76`
  - slot 3: `t=86`
- Settlement runs immediately after confirmed playback.
- Expiry runs after proof deadline for any `PAID_WINNER` slot that was not
  confirmed.
- Redis projection is rebuilt from events and direct reads; it is not authority.

This is the only demo option that fits `92s` cycles and `+4s` settlement
eligibility without relying on an open browser.

### Production Direction

Use separated production services:

- Dedicated reporter/oracle/APS path for proof creation.
- Permissionless keeper automation for snapshot/finalize/settle/expire.
- Event indexer with replay, monitoring, and multi-site support.
- Key rotation and role separation for admin, config admin, pauser, reporter,
  deployer, and low-value automation wallets.
- Alerts for stuck `PAID_WINNER`, stuck `PLAYED`, missed proof deadlines, RPC
  failures, and projection lag.

Do not treat the demo worker as the production trust model.

## 6. Short Lifecycle Timing

With current product config:

- `open`: `t=0..59`
- `locked`: `t=60..61`
- slot 1: `t=62..71`
- slot 2: `t=72..81`
- slot 3: `t=82..91`
- next cycle: `t=92`

Operational targets:

| Time | Action |
| --- | --- |
| `t=60` | finalize all three slots or finalize each slot before its playback proof |
| `t=66` | confirm slot 1 with four-second playback and settle |
| `t=76` | confirm slot 2 with four-second playback and settle |
| `t=86` | confirm slot 3 with four-second playback and settle |
| after slot proof deadline | expire unconfirmed `PAID_WINNER` slots |

If `proofDeadlineSeconds = 60`, the proof deadline is per slot end plus 60s:

- slot 1 deadline: `t=132`
- slot 2 deadline: `t=142`
- slot 3 deadline: `t=152`

The automation model must support sub-10-second observation for proof and
settlement parity. Vercel Cron should not be treated as capable of guaranteeing
that cadence.

## 7. State-Aware Idempotency Design

Pure algorithm:

1. Read site config and effective cycle.
2. Read or preview cycle.
3. Read slot state.
4. Derive exactly one next eligible action.
5. Check timestamp and role requirements.
6. Submit at most one transaction.
7. Wait for receipt when possible.
8. Reread state.
9. Classify result as `completed`, `already_completed`, `retryable`,
   `terminal`, `not_yet_eligible`, `unauthorized`, or `config_error`.

Decision table:

| Action | Submit when | Already completed | Retryable | Terminal | Not eligible |
| --- | --- | --- | --- | --- | --- |
| `snapshotCycle` | snapshot missing and `now >= startsAt` | snapshot exists | RPC timeout, unknown receipt | site not configured, invalid cycle | `now < startsAt` |
| `finalizeSlot` | slot `UNFINALIZED` and `now >= openEndsAt` | slot outcome not `UNFINALIZED` | timeout, stale revert followed by `PAID_WINNER` or `NO_PAID_WINNER` read | invalid slot/config | open still active |
| `confirmPlayback` | slot `PAID_WINNER`, reporter authorized, report ended, before/equal deadline | slot `PLAYED` or `SETTLED` | timeout then reread `PLAYED`; transient RPC | `EXPIRED`, `NO_PAID_WINNER`, wrong ad, nonce used with no matching played state | playback not ended or after deadline |
| `settleSlot` | slot `PLAYED` | slot `SETTLED` | timeout; USDC transfer failure leaves `PLAYED` | `EXPIRED`, `NO_PAID_WINNER`, invalid slot | not played |
| `expireSlot` | slot `PAID_WINNER` and `now > slotProofDeadline` | slot `EXPIRED` | timeout then reread `EXPIRED` | `SETTLED`, `PLAYED`, `NO_PAID_WINNER` | deadline not passed |

No localStorage lock may be a correctness boundary. A distributed lock may
reduce duplicate gas spend, but correctness must survive lock loss.

## 8. Concurrency And Recovery

| Scenario | Safe behavior |
| --- | --- |
| Two workers finalize simultaneously | One succeeds; the other reverts with `SlotAlreadyFinalized`; reread outcome and classify already completed. |
| UI and worker settle simultaneously | One succeeds; the other reverts with `SlotNotPlayed`; reread `SETTLED`. Prefer no UI settle button in first contract write stage. |
| Tx pending and second caller repeats | State-before-write plus reread handles either one success or both still pending. |
| Tx reverted but another caller completed action | Reread state before retry; classify completed if outcome advanced. |
| RPC timeout after mined tx | Do not blindly resubmit; reread slot/reservation/settlement state. |
| Service restart | Rebuild cursor from current/recent cycles and slot states, not in-memory state. |
| Redis fully cleared | Rebuild projection from events and direct contract reads. |
| Browser never opened | Worker still finalizes, reports, settles, expires; UI only observes. |
| Reporter confirmation submitted twice | Same nonce reverts; different nonce after success sees non-`PAID_WINNER` state. Reread and classify completed. |
| Malicious caller spams permissionless calls | Caller pays gas; contract state guards reject invalid/stale actions. |
| Whole cycle skipped | Late finalize then settle/expire according to current state; no browser dependency. |
| Past cycle unfinished | Worker scans recent cycles until all slots are terminal. |
| Multiple sites | Site/cycle/slot keys isolate state. Scheduler must handle each configured site independently. |

## 9. Reporter Trust Model

Current demo trust model:

- A trusted reporter service confirms that a specific ad was displayed for at
  least the reported interval, for example four seconds.
- `playbackStartedAt` and `playbackEndedAt` come from screen/player telemetry or
  another trusted display observation source.
- Creative/ad identity comes from the finalized contract slot and the screen
  render pipeline; the reporter must compare its observed creative with the
  expected `advertisementId`.
- The report binds to site/cycle/slot/winner through `siteId`, `cycleId`,
  `slotIndex`, and `advertisementId`.
- The reporter cannot confirm a different ad for the same slot because the
  contract checks `report.advertisementId == slot.advertisementId`.
- The report cannot be replayed by the same reporter nonce. A changed
  site/cycle/slot also changes the digest and must match a separate paid slot.
- The contract protects authorization, timing bounds, ad identity, nonce reuse,
  and paid-winner state.
- The contract does not prove that the media actually appeared on a physical or
  browser screen. `screenId` and `evidenceHash` are included in the digest but
  interpreted off-chain in V1.

Gap classification: reporter implementation gap and documentation gap for demo;
future stronger proof is an oracle/APS design task, not a current contract
blocker for the accepted trusted-reporter model.

## 10. Key And Role Separation

| Role | Rights | Private key required | Storage | Vercel runtime | Blast radius | Rotation | Can combine |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Admin / default admin | Grants roles; deploy-time admin; escrow admin | Yes | Cold/offline or controlled ops vault | No | Highest | Grant/revoke replacement admin, then remove old | Do not combine with runtime roles |
| Config admin | Configures sites and future site versions | Yes | Ops vault | No for normal runtime | High config impact | Grant/revoke role | Can be same human custody as admin, not same hot key |
| Pauser | Pauses/unpauses bids | Yes | Ops vault | No unless emergency path is private and authenticated | Medium/high | Grant/revoke role | Separate from reporter |
| Engine | Contract address with escrow `ENGINE_ROLE` | No EOA after deployment | On-chain only | Not applicable | Can reserve/settle/release through engine logic | Escrow engine is configured once | Must be `AuctionEngineV1` only |
| Reporter | Calls `confirmPlayback` | Yes | Dedicated worker/oracle secret store | No public route; no frontend | Can falsely attest playback within contract bounds | Grant new reporter, revoke old | Do not combine with legacy operator |
| Legacy operator | Calls old `/api/operator/process` path | Yes | Existing legacy server-only env | Existing legacy only | Legacy settlement only | Existing legacy procedure | Never reuse for reporter |
| Permissionless automation wallet | Calls snapshot/finalize/settle/expire | Yes, but no role | Low-value worker secret | Possible only for non-reporter internal job; not public | Gas loss only; no authority | Replace wallet anytime | Can be multiple wallets |
| Deployer | Deploys contracts and initial setup | Yes | Deployment environment only | No | Deployment-time critical | New deployment or admin handoff | Do not use at runtime |

Hard bans:

- No `OPERATOR_PRIVATE_KEY` reuse for reporter.
- No reporter key in frontend.
- No reporter key in `NEXT_PUBLIC_*`.
- No unauthenticated public route that signs/submits reporter transactions.
- No admin/deployer key in runtime.
- No single key for all roles.

## 11. Future API And Adapter Boundaries

Do not create one giant lifecycle file. Proposed future structure:

```text
lib/arc/contractV1/
  abi.ts                         # current read ABI only
  engineReads.ts                 # existing read adapter
  escrowReads.ts                 # existing read adapter
  lifecycle/
    types.ts                     # pure action/result/status types
    decisionEngine.ts            # pure next-action derivation
    timing.ts                    # slot windows and eligibility helpers
    stateClassifier.ts           # completed/retryable/terminal mapping
    permissionlessWriteAbi.ts    # future minimal write ABI
    permissionlessActions.ts     # future wallet-client wrappers
    receiptRecovery.ts           # future receipt timeout/state reread logic
    reporterTypes.ts             # report DTOs and validation
    reporterSubmit.ts            # server/worker-only reporter submission
    projectionEvents.ts          # event ingestion definitions
    projectionRebuild.ts         # Redis rebuild from chain
    roleConfig.ts                # server-only role/address config
```

Boundaries:

- Read adapters never write.
- Permissionless write adapters do not know reporter keys.
- Reporter submission does not call legacy operator routes.
- Decision engine is pure and mock-testable.
- Projection is derived from events/reads after receipts.
- API authentication belongs outside lifecycle decision logic.
- Role config is server/worker-only.

## 12. Test Plan

Unit tests:

- next action derivation per slot outcome;
- timestamp eligibility for `t=60`, `t=66`, `t=76`, `t=86`, proof deadline;
- completed/already-completed/retryable/terminal classification;
- RPC timeout then state recovery;
- config errors;
- unauthorized reporter classification.

Foundry tests:

- concurrent-like duplicate finalize;
- concurrent-like duplicate settle;
- late finalize after playback and after proof deadline;
- late settlement;
- late expiry;
- four-second proof, already covered by
  `testReporterCanConfirmFourSecondPlaybackAndSettle`;
- duplicate proof with same nonce;
- duplicate proof with different nonce after `PLAYED`;
- cross-slot/cross-cycle report reuse;
- reporter role revocation;
- transfer failure recovery, already covered for settlement retry.

Integration tests with mocks:

- RPC timeout after mined tx;
- receipt missing then recovered by state read;
- two workers racing the same action;
- Redis loss and rebuild;
- no browser ever opened;
- multi-site cycle processing;
- legacy `/api/operator/process` not invoked in contract mode.

## 13. Blockers Before First Contract V1 Write

- LA site must be configured on-chain or explicitly excluded from contract mode.
- Contract-mode write ABI and adapters must be added without touching legacy
  runtime paths.
- Reporter service boundary must be decided and kept out of public routes.
- Role env/config must separate reporter, admin, deployer, legacy operator, and
  permissionless automation.
- Projection must be able to rebuild from chain after Redis loss.
- Lifecycle decision engine must be state-aware and tested with mocks before any
  production automation.
- Contract mode must never call legacy `/api/operator/process`.
- Switching a site mid-cycle remains prohibited.
- Monitoring and stuck-state recovery must exist for `PAID_WINNER`, `PLAYED`,
  and projection lag.
