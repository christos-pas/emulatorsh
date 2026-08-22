import assert from "node:assert/strict";
import { test } from "node:test";

import {
  appleDeviceLabel,
  appleRuntimeFromKey,
  iosVersionFromRuntime,
  watchOsVersionFromRuntime,
} from "./runtime.js";

test("appleRuntimeFromKey reads iOS and watchOS simctl keys", () => {
  assert.deepEqual(appleRuntimeFromKey("com.apple.CoreSimulator.SimRuntime.iOS-18-4"), {
    os: "ios",
    version: "18.4",
    label: "iOS",
  });
  assert.deepEqual(appleRuntimeFromKey("com.apple.CoreSimulator.SimRuntime.watchOS-26-5"), {
    os: "watchos",
    version: "26.5",
    label: "watchOS",
  });
  assert.equal(appleRuntimeFromKey("com.apple.CoreSimulator.SimRuntime.tvOS-18-0"), null);
});

test("iosVersionFromRuntime stays iOS-only", () => {
  assert.equal(iosVersionFromRuntime("com.apple.CoreSimulator.SimRuntime.iOS-18-4"), "18.4");
  assert.equal(iosVersionFromRuntime("iOS-18"), "18");
  assert.equal(iosVersionFromRuntime("com.apple.CoreSimulator.SimRuntime.watchOS-11-0"), null);
});

test("watchOsVersionFromRuntime reads watch runtimes", () => {
  assert.equal(watchOsVersionFromRuntime("watchOS-11-0"), "11.0");
  assert.equal(watchOsVersionFromRuntime("iOS-18-4"), null);
});

test("appleDeviceLabel formats the menu name", () => {
  assert.equal(appleDeviceLabel("iPhone 17 Pro", "iOS-26-5"), "iPhone 17 Pro (iOS 26.5)");
  assert.equal(
    appleDeviceLabel("Apple Watch Series 11 (46mm)", "watchOS-26-5"),
    "Apple Watch Series 11 (46mm) (watchOS 26.5)",
  );
});
