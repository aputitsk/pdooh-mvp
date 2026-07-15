import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { ARC_READ_RATE_LIMIT_MESSAGE, ARC_READ_UNAVAILABLE_MESSAGE, isArcReadRateLimitError, normalizeArcReadError } from "./arcReadErrors.ts";

test("normalizes request limit errors", () => {
  assert.deepEqual(normalizeArcReadError(new Error("request limit reached")), {
    kind: "rate_limit",
    message: ARC_READ_RATE_LIMIT_MESSAGE,
  });
});

test("recognizes 429 in message", () => {
  assert.equal(
    normalizeArcReadError(new Error("HTTP 429 Too Many Requests")).message,
    ARC_READ_RATE_LIMIT_MESSAGE
  );
});

test("recognizes nested causes", () => {
  const error = new Error("Contract read failed", {
    cause: new Error("rate limited"),
  });

  assert.equal(isArcReadRateLimitError(error), true);
  assert.equal(normalizeArcReadError(error).message, ARC_READ_RATE_LIMIT_MESSAGE);
});

test("recognizes viem-like shortMessage", () => {
  assert.equal(
    normalizeArcReadError({
      message: "The contract function reverted.",
      shortMessage: "RPC Request failed: request limit reached",
    }).message,
    ARC_READ_RATE_LIMIT_MESSAGE
  );
});

test("recognizes viem-like details", () => {
  assert.equal(
    normalizeArcReadError({
      message: "RPC Request failed.",
      details: "too many requests",
    }).message,
    ARC_READ_RATE_LIMIT_MESSAGE
  );
});

test("normalizes unrelated temporary network errors", () => {
  assert.deepEqual(normalizeArcReadError(new Error("fetch failed")), {
    kind: "temporary",
    message: ARC_READ_UNAVAILABLE_MESSAGE,
  });
});

test("configuration mismatch is not misclassified as rate limit", () => {
  const error = new Error(
    "Configured pDOOH escrow Treasury does not match the application Treasury."
  );

  assert.equal(isArcReadRateLimitError(error), false);
  assert.deepEqual(normalizeArcReadError(error), {
    kind: "configuration",
    message:
      "Configured pDOOH escrow Treasury does not match the application Treasury.",
  });
});
