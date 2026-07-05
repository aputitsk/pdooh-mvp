import { ARC_EXPLORER_URL } from "./arcConstants";

export function getArcScanTransactionUrl(transactionHash: string) {
  return `${ARC_EXPLORER_URL}/tx/${transactionHash}`;
}

export function getArcScanAddressUrl(address: string) {
  return `${ARC_EXPLORER_URL}/address/${address}`;
}
