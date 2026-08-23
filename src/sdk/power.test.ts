import assert from "node:assert/strict";
import { test } from "node:test";

import { avdSnapshotsDir, emuOutputFailed, lineMatchesAvd } from "./power";

test("adb emu KO output is treated as failure", () => {
  assert.equal(emuOutputFailed("KO: unknown command\n"), true);
  assert.equal(emuOutputFailed("OK\n"), false);
  assert.equal(emuOutputFailed(""), false);
});

test("Quick Boot snapshots live under the AVD folder", () => {
  assert.match(avdSnapshotsDir("Pixel_9_API_36", "/tmp/avd"), /Pixel_9_API_36\.avd[/\\]snapshots$/);
});

test("AVD process matching does not treat _2 as the same device", () => {
  const base = "123 emulator -avd Resizable_Experimental_API_36 -netdelay none";
  const copy = "456 emulator -avd Resizable_Experimental_API_36_2 -netdelay none";
  assert.equal(lineMatchesAvd(base, "Resizable_Experimental_API_36"), true);
  assert.equal(lineMatchesAvd(copy, "Resizable_Experimental_API_36"), false);
  assert.equal(lineMatchesAvd(copy, "Resizable_Experimental_API_36_2"), true);
  assert.equal(lineMatchesAvd(base, "Resizable_Experimental_API_36_2"), false);
  assert.equal(
    lineMatchesAvd("/Users/me/.android/avd/Resizable_Experimental_API_36.avd/qemu", "Resizable_Experimental_API_36"),
    true,
  );
  assert.equal(
    lineMatchesAvd("/Users/me/.android/avd/Resizable_Experimental_API_36_2.avd/qemu", "Resizable_Experimental_API_36"),
    false,
  );
});
