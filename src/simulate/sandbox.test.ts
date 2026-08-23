import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createEmulatorsh } from "../sdk";
import { createHostSystem } from "../system/host";
import { createSandboxSystem } from "./sandbox";

function tmpDb(): { dir: string; storage: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "emulatorsh-sandbox-"));
  return { dir, storage: path.join(dir, "demo.db") };
}

test("host system has no fixture profile map", () => {
  const system = createHostSystem();
  assert.equal(system.kind, "host");
  assert.equal(system.profileSdks, undefined);
});

test("sandbox system lists fixture devices on macOS", () => {
  const { dir, storage } = tmpDb();
  try {
    const emu = createEmulatorsh({
      system: createSandboxSystem({ os: "macos", storage }),
    });
    assert.ok(emu.android.list().length > 0);
    assert.ok(emu.ios.list().length > 0);
    assert.ok(emu.watchos.list().length > 0);
    assert.ok(emu.android.list().every((item) => item.name));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("windows sandbox has Android and no Apple devices", () => {
  const { dir, storage } = tmpDb();
  try {
    const emu = createEmulatorsh({
      system: createSandboxSystem({ os: "windows", storage }),
    });
    assert.ok(emu.android.list().length > 0);
    assert.equal(emu.ios.list().length, 0);
    assert.equal(emu.watchos.list().length, 0);
    const android = emu.android.list();
    assert.deepEqual(
      emu.platforms.list().map((platform) => [platform.name, platform.installed, platform.running]),
      [
        ["android", android.length, android.filter((device) => device.running).length],
        ["ios", 0, 0],
        ["watchos", 0, 0],
      ],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("clients with different systems never share running or created devices", async () => {
  const a = tmpDb();
  const b = tmpDb();
  try {
    const em1 = createEmulatorsh({
      system: createSandboxSystem({ os: "macos", storage: a.storage }),
    });
    const em2 = createEmulatorsh({
      system: createSandboxSystem({ os: "macos", storage: b.storage }),
    });

    const runningOf = (em: typeof em1) =>
      Object.fromEntries(em.android.list().map((device) => [device.name, Boolean(device.running)]));

    const before2 = runningOf(em2);
    const stopped = em1.android.list().find((device) => !device.running);
    assert.ok(stopped, "fixture should include a stopped Android device");
    em1.android.start(stopped);
    assert.equal(em1.android.list().find((device) => device.name === stopped.name)?.running, true);
    assert.deepEqual(runningOf(em2), before2);

    let image = em1.android.images.listInstalled("phone")[0];
    if (!image) {
      const available = em1.android.images.listAvailable("phone").find((item) => !item.installed);
      assert.ok(available, "sandbox should list a phone system image");
      await em1.android.images.install(available);
      image = em1.android.images.listInstalled("phone").find((item) => item.package === available.package);
    }
    assert.ok(image);
    const profile = em1.android.profiles.list(image)[0];
    assert.ok(profile);
    const created = await em1.android.create(image, profile);
    assert.ok(em1.android.list().some((device) => device.name === created.name));
    assert.equal(
      em2.android.list().some((device) => device.name === created.name),
      false,
    );
  } finally {
    fs.rmSync(a.dir, { recursive: true, force: true });
    fs.rmSync(b.dir, { recursive: true, force: true });
  }
});
