import assert from "node:assert/strict";
import { test } from "node:test";

import { isPhoneSystemImage, isWearSystemImage, matchesFormFactor } from "./images";

test("form factor filters drop TV/Wear from phones and Chinese Wear images", () => {
  assert.equal(isPhoneSystemImage("google_apis_playstore"), true);
  assert.equal(isPhoneSystemImage("android-wear"), false);
  assert.equal(isPhoneSystemImage("android-tv"), false);
  assert.equal(isWearSystemImage("android-wear"), true);
  assert.equal(isWearSystemImage("android-wear-cn"), false);
  assert.equal(matchesFormFactor("google_apis_playstore", "phone"), true);
  assert.equal(matchesFormFactor("android-wear", "wear"), true);
  assert.equal(matchesFormFactor("android-wear", "phone"), false);
});
