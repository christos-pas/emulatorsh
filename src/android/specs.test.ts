import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isWearSpec,
  profileSupportsImage,
  specFromPackage,
  specFromSysdir,
  sysdirMatchesImage,
} from "./specs.js";

test("spec parsers round-trip package and sysdir", () => {
  assert.deepEqual(specFromPackage("system-images;android-36;google_apis_playstore;arm64-v8a"), {
    api: "36",
    tag: "google_apis_playstore",
  });
  assert.deepEqual(specFromSysdir("system-images/android-36/android-wear/arm64-v8a/"), {
    api: "36",
    tag: "android-wear",
  });
});

test("isWearSpec keys off the image tag", () => {
  assert.equal(isWearSpec({ api: "36", tag: "android-wear" }), true);
  assert.equal(isWearSpec({ api: "36", tag: "google_apis_playstore" }), false);
});

test("sysdirMatchesImage ignores a trailing slash", () => {
  const image = {
    api: "36",
    package: "system-images;android-36;google_apis_playstore;arm64-v8a",
    sysdir: "system-images/android-36/google_apis_playstore/arm64-v8a",
  };
  assert.equal(sysdirMatchesImage(`${image.sysdir}/`, image), true);
  assert.equal(sysdirMatchesImage("system-images/android-36/android-wear/arm64-v8a", image), false);
});

test("profileSupportsImage hides devices that do not list the SDK", () => {
  const image = {
    api: "36",
    package: "system-images;android-36;google_apis_playstore;arm64-v8a",
  };
  assert.equal(profileSupportsImage([{ api: "36", tag: "google_apis_playstore" }], image), true);
  assert.equal(profileSupportsImage([{ api: "35", tag: "google_apis_playstore" }], image), false);
  assert.equal(profileSupportsImage(undefined, image), true);
});
