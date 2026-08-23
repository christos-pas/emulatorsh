import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createEmulatorsh } from "./index";
import { EmulatorshError, ErrorCode } from "./errors";
import { createSandboxSystem } from "../simulate/sandbox";

function emu() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "emulatorsh-resolve-"));
  const client = createEmulatorsh({
    system: createSandboxSystem({ os: "macos", storage: path.join(dir, "demo.db") }),
  });
  return { dir, client };
}

test("platforms.list returns name, installed count, and running count", () => {
  const { dir, client } = emu();
  try {
    const listed = client.platforms.list();
    assert.deepEqual(
      listed.map((platform) => platform.name),
      ["android", "ios", "watchos"],
    );
    for (const platform of listed) {
      const devices =
        platform.name === "android"
          ? client.android.list()
          : platform.name === "ios"
            ? client.ios.list()
            : client.watchos.list();
      assert.equal(platform.installed, devices.length);
      assert.equal(platform.running, devices.filter((device) => device.running).length);
    }

    const android = listed.find((platform) => platform.name === "android");
    assert.ok(android);
    const stopped = client.android.list().find((device) => !device.running);
    assert.ok(stopped);
    client.android.start(stopped);
    assert.equal(
      client.platforms.list().find((platform) => platform.name === "android")?.running,
      android.running + 1,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("android.start accepts a name string or a listed device", () => {
  const { dir, client } = emu();
  try {
    const pixel = client.android.list().find((device) => device.name === "Pixel_9_API_36");
    assert.ok(pixel);
    client.android.start("Pixel_9_API_36");
    assert.equal(client.android.list().find((device) => device.name === "Pixel_9_API_36")?.running, true);
    client.android.suspend(pixel);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ios.start accepts a name, a labeled name, or a UDID", () => {
  const { dir, client } = emu();
  try {
    const iphone = client.ios.list().find((device) => device.name === "iPhone 17");
    assert.ok(iphone);
    client.ios.start("iPhone 17");
    assert.equal(client.ios.list().find((device) => device.name === "iPhone 17")?.running, true);

    client.ios.start(iphone.id);
    client.ios.start(`${iphone.name} (${iphone.runtime})`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("watchos.start accepts a watch name", () => {
  const { dir, client } = emu();
  try {
    client.watchos.start("Apple Watch Ultra 3 (49mm)");
    assert.equal(
      client.watchos.list().find((device) => device.name === "Apple Watch Ultra 3 (49mm)")?.running,
      true,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("get returns the same device as list, or DEVICE_NOT_FOUND", () => {
  const { dir, client } = emu();
  try {
    const listed = client.android.list().find((device) => device.name === "Pixel_9_API_36");
    assert.deepEqual(client.android.get("Pixel_9_API_36"), listed);

    const iphone = client.ios.list().find((device) => device.name === "iPhone 17");
    assert.ok(iphone);
    assert.deepEqual(client.ios.get("iPhone 17"), iphone);
    assert.deepEqual(client.ios.get(iphone.id), iphone);

    assert.throws(
      () => client.android.get("Not_An_Avd"),
      (error: unknown) => error instanceof EmulatorshError && error.code === ErrorCode.DEVICE_NOT_FOUND,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("android.profiles.list accepts an image or an SDK name", () => {
  const { dir, client } = emu();
  try {
    const fromApi = client.android.profiles.list("36");
    assert.ok(fromApi.some((item) => item.id === "pixel_9"));
    assert.ok(!fromApi.some((item) => item.id === "wearos_large_round"));

    const image = client.android.images.listInstalled("phone")[0];
    assert.ok(image);
    assert.deepEqual(
      client.android.profiles.list(image).map((item) => item.id),
      fromApi.map((item) => item.id),
    );

    const wear =
      client.android.images.listInstalled("wear")[0] ?? client.android.images.listAvailable("wear")[0];
    assert.ok(wear);
    const wearProfiles = client.android.profiles.list(wear.package);
    assert.ok(wearProfiles.some((item) => item.id === "wearos_large_round"));
    assert.ok(!wearProfiles.some((item) => item.id === "pixel_9"));

    assert.throws(
      () => client.android.profiles.list("not-an-sdk"),
      (error: unknown) => error instanceof EmulatorshError && error.code === ErrorCode.DEVICE_NOT_FOUND,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("android.create accepts a profile name and an SDK name", async () => {
  const { dir, client } = emu();
  try {
    const created = await client.android.create("36", "Pixel_9");
    assert.match(created.name, /Pixel_9_API_36/);
    const image = client.android.images.listInstalled("phone")[0];
    assert.ok(image);
    const profile = client.android.profiles.list(image).find((item) => item.id === "pixel_9");
    assert.ok(profile);
    const mixed = await client.android.create("36", profile);
    assert.match(mixed.name, /Pixel_9_API_36/);
    assert.equal(created.running, false);
    assert.ok(client.android.list().some((device) => device.name === created.name));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("android.create can install a missing SDK when installDeps is set", async () => {
  const { dir, client } = emu();
  try {
    const available = client.android.images.listAvailable("phone").find((image) => !image.installed);
    assert.ok(available);
    const created = await client.android.create(available.package, "Pixel 9", { installDeps: true });
    assert.ok(client.android.images.listInstalled("phone").some((image) => image.package === available.package));
    assert.ok(client.android.list().some((device) => device.name === created.name));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("android.create without installDeps fails if the SDK is missing", async () => {
  const { dir, client } = emu();
  try {
    const available = client.android.images.listAvailable("phone").find((image) => !image.installed);
    assert.ok(available);
    await assert.rejects(
      () => client.android.create(available.package, "Pixel_9"),
      (error: unknown) => error instanceof EmulatorshError && error.code === ErrorCode.SDK_NOT_INSTALLED,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing name throws DEVICE_NOT_FOUND", () => {
  const { dir, client } = emu();
  try {
    assert.throws(
      () => client.ios.start("iPhone that does not exist"),
      (error: unknown) => error instanceof EmulatorshError && error.code === ErrorCode.DEVICE_NOT_FOUND,
    );
    assert.throws(
      () => client.android.start("Not_An_Avd"),
      (error: unknown) => error instanceof EmulatorshError && error.code === ErrorCode.DEVICE_NOT_FOUND,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
