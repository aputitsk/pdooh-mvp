import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createArcEscrowValidationCache } from "./arcEscrowValidationCache.ts";

test("concurrent validation calls share one execution", async () => {
  const validateCached = createArcEscrowValidationCache();
  let callCount = 0;
  let resolveValidation = () => {};
  const validation = new Promise<void>((resolve) => {
    resolveValidation = resolve;
  });

  const first = validateCached("escrow:usdc:treasury", () => {
    callCount += 1;
    return validation;
  });
  const second = validateCached("escrow:usdc:treasury", () => {
    callCount += 1;
    return Promise.resolve();
  });

  assert.equal(first, second);
  assert.equal(callCount, 1);

  resolveValidation();
  await Promise.all([first, second]);
});

test("successful validation result is reused", async () => {
  const validateCached = createArcEscrowValidationCache();
  let callCount = 0;

  await validateCached("escrow:usdc:treasury", async () => {
    callCount += 1;
  });
  await validateCached("escrow:usdc:treasury", async () => {
    callCount += 1;
  });

  assert.equal(callCount, 1);
});

test("failed validation clears the cache", async () => {
  const validateCached = createArcEscrowValidationCache();
  let callCount = 0;

  await assert.rejects(
    validateCached("escrow:usdc:treasury", async () => {
      callCount += 1;
      throw new Error("request limit reached");
    }),
    /request limit reached/
  );

  await validateCached("escrow:usdc:treasury", async () => {
    callCount += 1;
  });

  assert.equal(callCount, 2);
});

test("retry after failure executes validation again", async () => {
  const validateCached = createArcEscrowValidationCache();
  let shouldFail = true;
  let callCount = 0;

  await assert.rejects(
    validateCached("escrow:usdc:treasury", async () => {
      callCount += 1;

      if (shouldFail) {
        throw new Error("temporary failure");
      }
    }),
    /temporary failure/
  );

  shouldFail = false;
  await validateCached("escrow:usdc:treasury", async () => {
    callCount += 1;
  });

  assert.equal(callCount, 2);
});

test("different validation keys do not share results", async () => {
  const validateCached = createArcEscrowValidationCache();
  let callCount = 0;

  await validateCached("escrow-a:usdc:treasury", async () => {
    callCount += 1;
  });
  await validateCached("escrow-b:usdc:treasury", async () => {
    callCount += 1;
  });

  assert.equal(callCount, 2);
});
