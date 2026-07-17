import type { Address } from "viem";

export type ContractV1AppMode = "legacy" | "contract_v1";
export type ContractV1Env = Record<string, string | undefined>;
export type ContractV1Bytes32 = `0x${string}`;

export type ContractV1DiagnosticIssueKind =
  | "config"
  | "rpc"
  | "contract_read"
  | "missing_snapshot"
  | "missing_state"
  | "invariant";

export type ContractV1DiagnosticIssue = {
  kind: ContractV1DiagnosticIssueKind;
  code: string;
  message: string;
  details?: string;
};

export type ContractV1CycleSnapshot = {
  exists: boolean;
  configVersion: bigint;
  configHash: ContractV1Bytes32;
  startsAt: bigint;
  openEndsAt: bigint;
  playbackStartsAt: bigint;
  endsAt: bigint;
  proofDeadlineEndsAt: bigint;
  slotCount: number;
  playbackSecondsPerSlot: bigint;
  minimumPaidBid: bigint;
  treasury: Address;
};

export type ContractV1SiteConfig = {
  exists: boolean;
  version: bigint;
  effectiveCycleId: bigint;
  firstCycleStartsAt: bigint;
  openSeconds: bigint;
  lockedSeconds: bigint;
  playbackSecondsPerSlot: bigint;
  proofDeadlineSeconds: bigint;
  slotCount: number;
  minimumPaidBid: bigint;
  treasury: Address;
  configHash: ContractV1Bytes32;
};

export type ContractV1SlotState = {
  outcome: number;
  paidWinner: Address;
  paidAmount: bigint;
  advertisementId: ContractV1Bytes32;
  reservationId: ContractV1Bytes32;
  settlementId: ContractV1Bytes32;
  playbackReportDigest: ContractV1Bytes32;
};

export type ContractV1SlotDiagnostic = {
  slotIndex: number;
  state: ContractV1SlotState;
  bidCount: bigint;
};

export type ContractV1EscrowAccount = {
  walletAddress: Address;
  balance: bigint;
  available: bigint;
  reserved: bigint;
};

export type ContractV1EscrowStaticConfig = {
  engineAddress: Address;
  usdcAddress: Address;
};

export type ContractV1EngineStaticConfig = {
  escrowAddress: Address;
};

export type ContractV1Reservation = {
  payer: Address;
  beneficiary: Address;
  engine: Address;
  reservedAmount: bigint;
  finalAmount: bigint;
  settled: boolean;
  released: boolean;
};

export type ContractV1Invariant = {
  code: string;
  ok: boolean;
  message: string;
};

export type ContractV1Diagnostics = {
  appMode: ContractV1AppMode;
  appModeRawValue: string | null;
  v1ConfigValid: boolean;
  chainId: number;
  addresses: {
    escrowV2: Address | null;
    engineV1: Address | null;
    escrowConfiguredEngine: Address | null;
    engineConfiguredEscrow: Address | null;
    usdc: Address | null;
  };
  siteKey: string;
  siteId: ContractV1Bytes32 | null;
  currentCycleId: bigint | null;
  effectiveCycleId: bigint | null;
  previewCycle: ContractV1CycleSnapshot | null;
  persistedCycleSnapshot: ContractV1CycleSnapshot | null;
  siteConfig: ContractV1SiteConfig | null;
  slots: ContractV1SlotDiagnostic[];
  walletEscrow: ContractV1EscrowAccount | null;
  invariants: ContractV1Invariant[];
  warnings: ContractV1DiagnosticIssue[];
  errors: ContractV1DiagnosticIssue[];
};
