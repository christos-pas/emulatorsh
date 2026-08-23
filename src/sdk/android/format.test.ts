import assert from "node:assert/strict";
import { test } from "node:test";

import {
  nextUniqueName,
  parseAvdApi,
  proposedAvdName,
  sanitizeAvdName,
} from "./format";

test("sanitizeAvdName keeps API in the slug and does not add _2", () => {
  assert.equal(sanitizeAvdName("Pixel 9", "36"), "Pixel_9_API_36");
  assert.equal(sanitizeAvdName("Wear OS Large Round", "36"), "Wear_OS_Large_Round_API_36");
});

test("nextUniqueName only suffixes when the base name is taken", () => {
  assert.equal(nextUniqueName("Pixel_9_API_36", []), "Pixel_9_API_36");
  assert.equal(nextUniqueName("Pixel_9_API_36", ["Pixel_9_API_36"]), "Pixel_9_API_36_2");
  assert.equal(
    nextUniqueName("Pixel_9_API_36", ["Pixel_9_API_36", "Pixel_9_API_36_2"]),
    "Pixel_9_API_36_3",
  );
});

test("proposedAvdName matches create-time uniqueness", () => {
  assert.equal(proposedAvdName("Pixel 9", "36", ["Pixel_9_API_36"]), "Pixel_9_API_36_2");
});

test("parseAvdApi does not treat uniqueness suffixes as part of the API", () => {
  const known = ["36", "37.2-beta2"];
  assert.equal(parseAvdApi("Pixel_9_API_36", known), "36");
  assert.equal(parseAvdApi("Pixel_9_API_36_2", known), "36");
  assert.equal(parseAvdApi("Galaxy_Nexus_API_37.2-beta2", known), "37.2-beta2");
  assert.equal(parseAvdApi("Galaxy_Nexus_API_37.2-beta2_2", known), "37.2-beta2");
  assert.equal(parseAvdApi("Something_Else", known), undefined);
});
