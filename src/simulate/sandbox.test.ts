import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import { createEmulatorsh } from "../sdk";
import { bindSystem, getSystem, isSandbox } from "../system/context";
import { createHostSystem } from "../system/host";
import { createSandboxSystem } from "./sandbox";

afterEach(() => {
  bindSystem(createHostSystem());
});

test("live mode uses a host system with no fixture profile map", () => {
  assert.equal(getSystem().kind, "host");
  assert.equal(isSandbox(), false);
  assert.equal(getSystem().profileSdks, undefined);
});

test("sandbox system lists fixture devices on macOS", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "emulatorsh-sandbox-"));
  try {
    const emu = createEmulatorsh({
      system: createSandboxSystem({ os: "macos", storage: path.join(dir, "demo.db") }),
    });
    assert.equal(getSystem().kind, "sandbox");
    assert.ok(emu.android.list().length > 0);
    assert.ok(emu.ios.list().length > 0);
    assert.ok(emu.watchos.list().length > 0);
    assert.equal(emu.android.list().every((item) => !item.create), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("windows sandbox has Android and no Apple devices", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "emulatorsh-sandbox-"));
  try {
    const emu = createEmulatorsh({
      system: createSandboxSystem({ os: "windows", storage: path.join(dir, "demo.db") }),
    });
    assert.ok(emu.android.list().length > 0);
    assert.equal(emu.ios.list().length, 0);
    assert.equal(emu.watchos.list().length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
