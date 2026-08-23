import assert from "node:assert/strict";
import { test } from "node:test";

import { isAllowedPhoneProfile, isAllowedWearProfile, parseDeviceDefinitions } from "./profiles";

test("parseDeviceDefinitions reads avdmanager list device blocks", () => {
  const devices = parseDeviceDefinitions(`
id: 0 or "pixel_9"
    Name: Pixel 9
    Tag : google
--------
id: 1 or "wearos_large_round"
    Name: Wear OS Large Round
    Tag : android-wear
--------
`);
  assert.deepEqual(devices, [
    { id: "pixel_9", name: "Pixel 9", tag: "google" },
    { id: "wearos_large_round", name: "Wear OS Large Round", tag: "android-wear" },
  ]);
});

test("phone allowlist keeps Pixels and drops Wear / TV / XR", () => {
  assert.equal(isAllowedPhoneProfile({ id: "pixel_9", name: "Pixel 9", tag: "google" }), true);
  assert.equal(isAllowedPhoneProfile({ id: "resizable", name: "Resizable", tag: "" }), true);
  assert.equal(
    isAllowedPhoneProfile({ id: "wearos_large_round", name: "Wear OS Large Round", tag: "android-wear" }),
    false,
  );
  assert.equal(isAllowedPhoneProfile({ id: "tv_4k", name: "Television", tag: "" }), false);
});

test("wear allowlist is the popular round/square ids", () => {
  assert.equal(isAllowedWearProfile({ id: "wearos_large_round", name: "Wear OS Large Round", tag: "" }), true);
  assert.equal(isAllowedWearProfile({ id: "wearos_xl_round", name: "Wear OS XL Round", tag: "" }), false);
});
