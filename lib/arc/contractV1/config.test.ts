import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { CONTRACT_V1_APP_MODE_ENV_NAME, getContractV1AppModeConfig } from "./appMode.ts";
// @ts-expect-error Node's type-stripping runner requires the .ts extension.
import { CONTRACT_V1_ENGINE_ADDRESS_ENV_NAME, CONTRACT_V1_ESCROW_ADDRESS_ENV_NAME, getContractV1AddressConfig } from "./config.ts";

const ESCROW_ADDRESS = "0x00000000000000000000000000000000000000e1";
const ENGINE_ADDRESS = "0x00000000000000000000000000000000000000e2";

test("Contract V1 app mode defaults to legacy", () => {
  const config = getContractV1AppModeConfig({});

  assert.equal(config.mode, "legacy");
  assert.equal(config.isContractMode, false);
  assert.equal(config.valid, true);
});

test("Contract V1 app mode accepts contract_v1 explicitly", () => {
  const config = getContractV1AppModeConfig({
    [CONTRACT_V1_APP_MODE_ENV_NAME]: "contract_v1",
  });

  assert.equal(config.mode, "contract_v1");
  assert.equal(config.isContractMode, true);
  assert.equal(config.valid, true);
});

test("unknown Contract V1 app mode falls back to legacy with an error", () => {
  const config = getContractV1AppModeConfig({
    [CONTRACT_V1_APP_MODE_ENV_NAME]: "contract_v2",
  });

  assert.equal(config.mode, "legacy");
  assert.equal(config.isContractMode, false);
  assert.equal(config.valid, false);
  assert.equal(config.errors[0]?.code, "contract_v1_unknown_app_mode");
});

test("missing V1 addresses are valid while app mode is legacy", () => {
  const config = getContractV1AddressConfig({
    [CONTRACT_V1_APP_MODE_ENV_NAME]: "legacy",
  });

  assert.equal(config.valid, true);
  assert.equal(config.escrowAddress, null);
  assert.equal(config.engineAddress, null);
});

test("legacy escrow env is not reused for Contract V1 addresses", () => {
  const config = getContractV1AddressConfig({
    [CONTRACT_V1_APP_MODE_ENV_NAME]: "contract_v1",
    NEXT_PUBLIC_PDOOH_ESCROW_ADDRESS: ESCROW_ADDRESS,
  });

  assert.equal(config.valid, false);
  assert.equal(config.escrowAddress, null);
  assert.equal(config.engineAddress, null);
  assert.deepEqual(
    config.errors.map((error) => error.code),
    ["contract_v1_address_missing", "contract_v1_address_missing"]
  );
});

test("Contract V1 mode requires valid V2 escrow and engine addresses", () => {
  const config = getContractV1AddressConfig({
    [CONTRACT_V1_APP_MODE_ENV_NAME]: "contract_v1",
    [CONTRACT_V1_ESCROW_ADDRESS_ENV_NAME]: ESCROW_ADDRESS,
    [CONTRACT_V1_ENGINE_ADDRESS_ENV_NAME]: ENGINE_ADDRESS,
  });

  assert.equal(config.valid, true);
  assert.equal(config.escrowAddress?.toLowerCase(), ESCROW_ADDRESS);
  assert.equal(config.engineAddress?.toLowerCase(), ENGINE_ADDRESS);
});

test("invalid V1 addresses are errors in contract_v1 mode", () => {
  const config = getContractV1AddressConfig({
    [CONTRACT_V1_APP_MODE_ENV_NAME]: "contract_v1",
    [CONTRACT_V1_ESCROW_ADDRESS_ENV_NAME]: "not-an-address",
    [CONTRACT_V1_ENGINE_ADDRESS_ENV_NAME]:
      "0x0000000000000000000000000000000000000000",
  });

  assert.equal(config.valid, false);
  assert.deepEqual(
    config.errors.map((error) => error.code),
    ["contract_v1_address_invalid", "contract_v1_address_zero"]
  );
});
