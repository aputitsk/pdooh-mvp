import { isAddress, zeroAddress, type Address } from "viem";

const escrowAddress = process.env.NEXT_PUBLIC_PDOOH_ESCROW_ADDRESS;

export function getArcEscrowAddress(): Address {
  if (!escrowAddress) {
    throw new Error(
      "NEXT_PUBLIC_PDOOH_ESCROW_ADDRESS is not configured."
    );
  }

  if (!isAddress(escrowAddress)) {
    throw new Error(
      "NEXT_PUBLIC_PDOOH_ESCROW_ADDRESS must be a valid EVM address."
    );
  }

  if (escrowAddress.toLowerCase() === zeroAddress) {
    throw new Error(
      "NEXT_PUBLIC_PDOOH_ESCROW_ADDRESS cannot be the zero address."
    );
  }

  return escrowAddress;
}
