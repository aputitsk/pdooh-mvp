import { createPublicClient, http, parseAbiItem, type Chain } from "viem";

import {
  ARC_CHAIN_ID,
  ARC_CHAIN_NAME,
  ARC_EXPLORER_URL,
  ARC_NATIVE_CURRENCY_SYMBOL,
  ARC_RPC_URL,
} from "./arcConstants";
import { getArcEscrowAddress } from "./arcEscrowConfig";

const ARC_ESCROW_DEPLOYMENT_BLOCK = BigInt(48_502_475);
const ARC_GET_LOGS_MAX_BLOCK_RANGE = BigInt(10_000);

const settledEvent = parseAbiItem(
  "event Settled(address indexed advertiser, uint256 amount, bytes32 indexed settlementId)"
);

const arcTestnetChain = {
  id: ARC_CHAIN_ID,
  name: ARC_CHAIN_NAME,
  nativeCurrency: {
    name: ARC_NATIVE_CURRENCY_SYMBOL,
    symbol: ARC_NATIVE_CURRENCY_SYMBOL,
    decimals: 18,
  },
  rpcUrls: { default: { http: [ARC_RPC_URL] } },
  blockExplorers: {
    default: { name: "ArcScan", url: ARC_EXPLORER_URL },
  },
  testnet: true,
} as const satisfies Chain;

const arcPublicClient = createPublicClient({
  chain: arcTestnetChain,
  transport: http(ARC_RPC_URL),
});

export type ArcSettlementEvent = {
  advertiser: `0x${string}`;
  amountMinorUnits: bigint;
  settlementId: `0x${string}`;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  logIndex: number;
};

function getChunkEndBlock(fromBlock: bigint, latestBlock: bigint) {
  const chunkEndBlock = fromBlock + ARC_GET_LOGS_MAX_BLOCK_RANGE - BigInt(1);

  return chunkEndBlock > latestBlock ? latestBlock : chunkEndBlock;
}

export async function listArcSettlementEvents(): Promise<ArcSettlementEvent[]> {
  const escrowAddress = getArcEscrowAddress();
  const latestBlock = await arcPublicClient.getBlockNumber();
  const settlementEvents: ArcSettlementEvent[] = [];

  for (
    let fromBlock = ARC_ESCROW_DEPLOYMENT_BLOCK;
    fromBlock <= latestBlock;
    fromBlock = getChunkEndBlock(fromBlock, latestBlock) + BigInt(1)
  ) {
    const logs = await arcPublicClient.getLogs({
      address: escrowAddress,
      event: settledEvent,
      fromBlock,
      toBlock: getChunkEndBlock(fromBlock, latestBlock),
    });

    logs.forEach((log) => {
      const { advertiser, amount, settlementId } = log.args;

      if (
        !advertiser ||
        amount === undefined ||
        !settlementId ||
        !log.transactionHash
      ) {
        return;
      }

      settlementEvents.push({
        advertiser,
        amountMinorUnits: amount,
        settlementId,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
      });
    });
  }

  return settlementEvents;
}
