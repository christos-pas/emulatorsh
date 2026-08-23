import assert from "node:assert/strict";
import { test } from "node:test";

import { SIMULATE_INSTALL_NOTE } from "../../sdk/constants";
import { sdkDownloadLine, sdkProgressBar, withSimulateInstallNote } from "./install-progress";

test("sdk progress bar matches sdkmanager-style width and percent", () => {
  assert.equal(sdkProgressBar(0), `[${" ".repeat(38)}]   0%`);
  assert.equal(sdkProgressBar(100), `[${"=".repeat(38)}] 100%`);
  assert.match(sdkProgressBar(50), /^\[=+\s+\]  50%$/);
});

test("download line includes fake size and the simulation suffix", () => {
  assert.equal(sdkDownloadLine(50), `${sdkProgressBar(50)}   181 MB / 362 MB`);
  assert.equal(
    withSimulateInstallNote(sdkDownloadLine(100)),
    `${sdkProgressBar(100)}   362 MB / 362 MB ${SIMULATE_INSTALL_NOTE}`,
  );
});
