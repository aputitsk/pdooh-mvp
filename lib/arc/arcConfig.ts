import { isAddress, zeroAddress, type Address } from "viem";

const treasuryAddress = process.env.NEXT_PUBLIC_PDOOH_TREASURY_ADDRESS;

function parseTreasuryAddress(value: string | undefined): Address {
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_PDOOH_TREASURY_ADDRESS is not configured."
    );
  }

  if (!isAddress(value)) {
    throw new Error(
      "NEXT_PUBLIC_PDOOH_TREASURY_ADDRESS must be a valid EVM address."
    );
  }

  if (value.toLowerCase() === zeroAddress) {
    throw new Error(
      "NEXT_PUBLIC_PDOOH_TREASURY_ADDRESS cannot be the zero address."
    );
  }

  return value;
}

export const ARC_TREASURY_ADDRESS = parseTreasuryAddress(treasuryAddress);
