export const auctionEscrowV2ReadAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "availableOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "reservedOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getReservation",
    stateMutability: "view",
    inputs: [{ name: "reservationId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "payer", type: "address" },
          { name: "beneficiary", type: "address" },
          { name: "engine", type: "address" },
          { name: "reservedAmount", type: "uint256" },
          { name: "finalAmount", type: "uint256" },
          { name: "settled", type: "bool" },
          { name: "released", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "engine",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "usdc",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const cycleSnapshotComponents = [
  { name: "exists", type: "bool" },
  { name: "configVersion", type: "uint32" },
  { name: "configHash", type: "bytes32" },
  { name: "startsAt", type: "uint64" },
  { name: "openEndsAt", type: "uint64" },
  { name: "playbackStartsAt", type: "uint64" },
  { name: "endsAt", type: "uint64" },
  { name: "proofDeadlineEndsAt", type: "uint64" },
  { name: "slotCount", type: "uint8" },
  { name: "playbackSecondsPerSlot", type: "uint32" },
  { name: "minimumPaidBid", type: "uint256" },
  { name: "treasury", type: "address" },
] as const;

const siteConfigComponents = [
  { name: "exists", type: "bool" },
  { name: "version", type: "uint32" },
  { name: "effectiveCycleId", type: "uint64" },
  { name: "firstCycleStartsAt", type: "uint64" },
  { name: "openSeconds", type: "uint32" },
  { name: "lockedSeconds", type: "uint32" },
  { name: "playbackSecondsPerSlot", type: "uint32" },
  { name: "proofDeadlineSeconds", type: "uint32" },
  { name: "slotCount", type: "uint8" },
  { name: "minimumPaidBid", type: "uint256" },
  { name: "treasury", type: "address" },
  { name: "configHash", type: "bytes32" },
] as const;

const slotStateComponents = [
  { name: "outcome", type: "uint8" },
  { name: "paidWinner", type: "address" },
  { name: "paidAmount", type: "uint256" },
  { name: "advertisementId", type: "bytes32" },
  { name: "reservationId", type: "bytes32" },
  { name: "settlementId", type: "bytes32" },
  { name: "playbackReportDigest", type: "bytes32" },
] as const;

export const auctionEngineV1ReadAbi = [
  {
    type: "function",
    name: "currentCycleId",
    stateMutability: "view",
    inputs: [{ name: "siteId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "previewCycle",
    stateMutability: "view",
    inputs: [
      { name: "siteId", type: "bytes32" },
      { name: "cycleId", type: "uint64" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: cycleSnapshotComponents,
      },
    ],
  },
  {
    type: "function",
    name: "getSiteConfig",
    stateMutability: "view",
    inputs: [
      { name: "siteId", type: "bytes32" },
      { name: "version", type: "uint32" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: siteConfigComponents,
      },
    ],
  },
  {
    type: "function",
    name: "getSiteConfigForCycle",
    stateMutability: "view",
    inputs: [
      { name: "siteId", type: "bytes32" },
      { name: "cycleId", type: "uint64" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: siteConfigComponents,
      },
    ],
  },
  {
    type: "function",
    name: "getCycleSnapshot",
    stateMutability: "view",
    inputs: [
      { name: "siteId", type: "bytes32" },
      { name: "cycleId", type: "uint64" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: cycleSnapshotComponents,
      },
    ],
  },
  {
    type: "function",
    name: "getSlotState",
    stateMutability: "view",
    inputs: [
      { name: "siteId", type: "bytes32" },
      { name: "cycleId", type: "uint64" },
      { name: "slotIndex", type: "uint8" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: slotStateComponents,
      },
    ],
  },
  {
    type: "function",
    name: "getSlotBidCount",
    stateMutability: "view",
    inputs: [
      { name: "siteId", type: "bytes32" },
      { name: "cycleId", type: "uint64" },
      { name: "slotIndex", type: "uint8" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "escrow",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;
