import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { createInFlightRequestDedupe } from "./inFlightRequestDedupe.ts";

test("concurrent identical wallet balance reads share one execution", async () => {
  const runDeduped = createInFlightRequestDedupe<number>();
  let callCount = 0;
  let resolveRead: (value: number) => void = () => {};
  const read = new Promise<number>((resolve) => {
    resolveRead = resolve;
  });

  const first = runDeduped("wallet:0xabc", () => {
    callCount += 1;
    return read;
  });
  const second = runDeduped("wallet:0xabc", () => {
    callCount += 1;
    return Promise.resolve(2);
  });

  assert.equal(first, second);
  assert.equal(callCount, 1);

  resolveRead(1);
  assert.equal(await first, 1);
});

test("concurrent identical escrow balance reads share one execution", async () => {
  const runDeduped = createInFlightRequestDedupe<number>();
  let callCount = 0;

  const first = runDeduped("escrow:0xabc", async () => {
    callCount += 1;
    return 5;
  });
  const second = runDeduped("escrow:0xabc", async () => {
    callCount += 1;
    return 6;
  });

  assert.equal(first, second);
  assert.equal(await second, 5);
  assert.equal(callCount, 1);
});

test("after success a later refresh executes again", async () => {
  const runDeduped = createInFlightRequestDedupe<number>();
  let callCount = 0;

  assert.equal(
    await runDeduped("wallet:0xabc", async () => {
      callCount += 1;
      return 1;
    }),
    1
  );
  assert.equal(
    await runDeduped("wallet:0xabc", async () => {
      callCount += 1;
      return 2;
    }),
    2
  );

  assert.equal(callCount, 2);
});

test("after failure Retry executes again", async () => {
  const runDeduped = createInFlightRequestDedupe<number>();
  let callCount = 0;

  await assert.rejects(
    runDeduped("escrow:0xabc", async () => {
      callCount += 1;
      throw new Error("request limit reached");
    }),
    /request limit reached/
  );

  assert.equal(
    await runDeduped("escrow:0xabc", async () => {
      callCount += 1;
      return 3;
    }),
    3
  );

  assert.equal(callCount, 2);
});

test("different wallet addresses do not share requests", async () => {
  const runDeduped = createInFlightRequestDedupe<number>();
  let callCount = 0;

  const first = runDeduped("wallet:0xabc", async () => {
    callCount += 1;
    return 1;
  });
  const second = runDeduped("wallet:0xdef", async () => {
    callCount += 1;
    return 2;
  });

  assert.equal(await first, 1);
  assert.equal(await second, 2);
  assert.equal(callCount, 2);
});
