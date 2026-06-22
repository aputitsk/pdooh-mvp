export const USDC_DECIMALS = 6;
export const USDC_MINOR_UNITS = 1_000_000;

export type UsdcMinorUnits = number;

const usdcInputPattern = /^\d+(?:\.\d+)?$/;

function assertSafeMinorUnits(amount: bigint) {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("USDC amount exceeds safe integer range.");
  }
}

export function parseUSDCToMinorUnits(value: string): UsdcMinorUnits {
  if (typeof value !== "string") {
    throw new TypeError("USDC value must be a string.");
  }

  if (value.length === 0) {
    throw new Error("USDC value cannot be empty.");
  }

  if (!usdcInputPattern.test(value)) {
    throw new Error("USDC value must be a non-negative decimal string.");
  }

  const [wholePart, fractionalPart = ""] = value.split(".");

  if (fractionalPart.length > USDC_DECIMALS) {
    throw new Error("USDC value cannot have more than 6 decimal places.");
  }

  const paddedFractionalPart = fractionalPart.padEnd(USDC_DECIMALS, "0");
  const minorUnits = BigInt(`${wholePart}${paddedFractionalPart}`);

  assertSafeMinorUnits(minorUnits);

  return Number(minorUnits);
}

export function formatUSDCFromMinorUnits(amount: UsdcMinorUnits): string {
  if (!Number.isSafeInteger(amount)) {
    throw new TypeError("USDC minor units must be a safe integer.");
  }

  if (amount < 0) {
    throw new RangeError("USDC minor units cannot be negative.");
  }

  const wholePart = Math.trunc(amount / USDC_MINOR_UNITS);
  const fractionalPart = amount % USDC_MINOR_UNITS;

  if (fractionalPart === 0) {
    return String(wholePart);
  }

  const trimmedFractionalPart = String(fractionalPart)
    .padStart(USDC_DECIMALS, "0")
    .replace(/0+$/, "");

  return `${wholePart}.${trimmedFractionalPart}`;
}

export function isValidUSDCInput(value: string): boolean {
  try {
    parseUSDCToMinorUnits(value);
    return true;
  } catch {
    return false;
  }
}
