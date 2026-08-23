import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { createEmulatorsh, type Emulatorsh } from "./index";
import { createSandboxSystem, clearSandboxStorage } from "../simulate/sandbox";
import type { HostOs } from "../system/types";

const DB_DIR = path.resolve(fileURLToPath(new URL("../../db", import.meta.url)));

function dbFile(name: string): string {
  return path.join(DB_DIR, name);
}

function openSandbox(os: HostOs, storage: string) {
  const system = createSandboxSystem({ os, storage });
  return { system, client: createEmulatorsh({ system }) };
}

function runningOf(client: Emulatorsh) {
  return {
    android: Object.fromEntries(client.android.list().map((device) => [device.name, device.running])),
    ios: Object.fromEntries(client.ios.list().map((device) => [device.id, device.running])),
    watchos: Object.fromEntries(client.watchos.list().map((device) => [device.id, device.running])),
  };
}

async function walkSdk(os: HostOs, storage: string): Promise<void> {
  clearSandboxStorage(storage);
  const apple = os === "macos";
  const { system, client } = openSandbox(os, storage);

  try {
    const platforms = client.platforms.list();
    assert.deepEqual(
      platforms.map((platform) => platform.name),
      ["android", "ios", "watchos"],
    );

    const android = platforms.find((platform) => platform.name === "android");
    const ios = platforms.find((platform) => platform.name === "ios");
    const watchos = platforms.find((platform) => platform.name === "watchos");
    assert.ok(android && ios && watchos);
    assert.ok(android.installed > 0);
    if (apple) {
      assert.ok(ios.installed > 0);
      assert.ok(watchos.installed > 0);
    } else {
      assert.equal(ios.installed, 0);
      assert.equal(watchos.installed, 0);
      assert.equal(client.ios.list().length, 0);
      assert.equal(client.watchos.list().length, 0);
    }

    const pixel = client.android.get("Pixel_9_API_36");
    assert.equal(pixel.running, false);

    client.android.start(pixel);
    assert.equal(client.android.get(pixel).running, true);
    client.android.suspend(pixel);
    assert.equal(client.android.get(pixel).running, false);
    client.android.start(pixel.name);
    client.android.terminate(pixel);
    assert.equal(client.android.get(pixel).running, false);

    if (apple) {
      const iphone = client.ios.get("iPhone 17");
      const watch = client.watchos.get("Apple Watch Ultra 3 (49mm)");
      assert.equal(iphone.running, false);
      assert.equal(watch.running, false);

      client.ios.start(iphone);
      assert.equal(client.ios.get(iphone.id).running, true);
      client.ios.suspend(iphone);
      assert.equal(client.ios.get(iphone).running, false);

      client.watchos.start(watch);
      assert.equal(client.watchos.get(watch.name).running, true);
      client.watchos.suspend(watch);
      assert.equal(client.watchos.get(watch).running, false);
    }

    const phones = client.android.images.listInstalled("phone");
    const wearInstalled = client.android.images.listInstalled("wear");
    const wearAvailable = client.android.images.listAvailable("wear");
    assert.ok(phones.length > 0);
    assert.ok(wearInstalled.length + wearAvailable.length > 0);
    assert.ok(wearAvailable.every((image) => /wear/i.test(image.package)));

    const missing = client.android.images.listAvailable("phone").find((image) => !image.installed);
    assert.ok(missing);
    await client.android.images.install(missing);
    assert.ok(client.android.images.listInstalled("phone").some((image) => image.package === missing.package));

    const profiles = client.android.profiles.list("36");
    assert.ok(profiles.some((profile) => profile.id === "pixel_9"));
    assert.ok(!profiles.some((profile) => profile.id === "wearos_large_round"));

    const beforeAndroid = client.android.list().length;
    const created = await client.android.create("36", "Pixel_9");
    assert.equal(created.running, false);
    assert.equal(client.android.list().length, beforeAndroid + 1);

    client.android.start(created);
    assert.equal(client.android.get(created).running, true);
    client.android.suspend(created);
    assert.equal(client.android.get(created).running, false);
    client.android.start(created);
    client.android.terminate(created);
    assert.equal(client.android.get(created).running, false);

    const androidPlatform = client.platforms.list().find((platform) => platform.name === "android");
    assert.equal(androidPlatform?.installed, beforeAndroid + 1);
    assert.equal(androidPlatform?.running, 0);

    system.store.close();

    const again = openSandbox(os, storage);
    try {
      const restored = again.client.android.get(created.name);
      assert.equal(restored.running, false);
      assert.ok(
        again.client.android.images.listInstalled("phone").some((image) => image.package === missing.package),
      );

      again.client.android.start(restored);
      const after = again.client.platforms.list();
      assert.equal(after.find((platform) => platform.name === "android")?.running, 1);

      if (apple) {
        const iphone = again.client.ios.get("iPhone 17");
        const watch = again.client.watchos.get("Apple Watch Ultra 3 (49mm)");
        again.client.ios.start(iphone);
        again.client.watchos.start(watch);
        assert.equal(again.client.platforms.list().find((platform) => platform.name === "ios")?.running, 1);
        assert.equal(again.client.platforms.list().find((platform) => platform.name === "watchos")?.running, 1);
        again.client.ios.suspend(iphone);
        again.client.watchos.suspend(watch);
      } else {
        assert.equal(after.find((platform) => platform.name === "ios")?.running, 0);
        assert.equal(after.find((platform) => platform.name === "watchos")?.running, 0);
      }

      again.client.android.suspend(restored);
      assert.ok(again.client.platforms.list().every((platform) => platform.running === 0));
    } finally {
      again.system.store.close();
    }
  } finally {
    system.store.close();
  }
}

for (const os of ["macos", "linux", "windows"] as const) {
  test(`sandbox integration walks the full SDK on ${os}`, async () => {
    await walkSdk(os, dbFile(`tests-${os}.db`));
  });
}

test("two sandboxes on test1.db and test2.db do not leak", async () => {
  const storage1 = dbFile("test1.db");
  const storage2 = dbFile("test2.db");
  clearSandboxStorage(storage1);
  clearSandboxStorage(storage2);

  const one = openSandbox("macos", storage1);
  const two = openSandbox("macos", storage2);

  try {
    const beforeTwo = runningOf(two.client);
    const namesTwo = two.client.android.list().map((device) => device.name);
    const installedTwo = two.client.android.images.listInstalled("phone").map((image) => image.package);

    const stopped = one.client.android.list().find((device) => !device.running);
    assert.ok(stopped);
    one.client.android.start(stopped);
    assert.equal(one.client.android.get(stopped).running, true);
    assert.deepEqual(runningOf(two.client), beforeTwo);

    const missing = one.client.android.images.listAvailable("phone").find((image) => !image.installed);
    assert.ok(missing);
    await one.client.android.images.install(missing);
    const created = await one.client.android.create("36", "Pixel_9");
    one.client.android.start(created);

    assert.equal(
      two.client.android.list().some((device) => device.name === created.name),
      false,
    );
    assert.deepEqual(
      two.client.android.images.listInstalled("phone").map((image) => image.package),
      installedTwo,
    );
    assert.deepEqual(
      two.client.android.list().map((device) => device.name),
      namesTwo,
    );

    const other = two.client.android.list().find((device) => device.name !== stopped.name && !device.running);
    assert.ok(other);
    two.client.android.start(other);
    const createdTwo = await two.client.android.create("36", "Pixel_8");

    assert.equal(one.client.android.get(stopped).running, true);
    assert.equal(
      one.client.android.list().some((device) => device.name === createdTwo.name),
      false,
    );
    assert.equal(two.client.android.get(stopped.name).running, false);

    one.system.store.close();
    two.system.store.close();

    const againOne = openSandbox("macos", storage1);
    const againTwo = openSandbox("macos", storage2);
    try {
      assert.ok(againOne.client.android.list().some((device) => device.name === created.name));
      assert.equal(
        againOne.client.android.list().some((device) => device.name === createdTwo.name),
        false,
      );
      assert.ok(againTwo.client.android.list().some((device) => device.name === createdTwo.name));
      assert.equal(
        againTwo.client.android.list().some((device) => device.name === created.name),
        false,
      );
      assert.ok(
        againOne.client.android.images.listInstalled("phone").some((image) => image.package === missing.package),
      );
      assert.equal(
        againTwo.client.android.images.listInstalled("phone").some((image) => image.package === missing.package),
        installedTwo.includes(missing.package),
      );
    } finally {
      againOne.system.store.close();
      againTwo.system.store.close();
    }
  } finally {
    one.system.store.close();
    two.system.store.close();
  }
});
