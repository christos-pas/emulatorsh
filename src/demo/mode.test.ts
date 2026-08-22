import assert from "node:assert/strict";
import { test } from "node:test";

import { isSimulate, simulateProfileSdks } from "./mode.js";

test("live mode has no simulate flag and no fixture profile map", () => {
  assert.equal(isSimulate(), false);
  assert.equal(simulateProfileSdks(), undefined);
});
