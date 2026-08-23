import assert from "node:assert/strict";
import { test } from "node:test";

import { isCloseRequest } from "../close";
import { cell, prompt, stripAnsi } from "./prompt";

test("cells keep the installed badge when the name is truncated", () => {
  const line = cell(
    { name: "Very_Long_Wear_OS_Large_Round_API_36", value: "x", installedCount: 2 },
    0,
    0,
    28,
  );
  const plain = stripAnsi(line);
  assert.match(plain, /\[installed: 2\]/);
  assert.equal(plain.length, 28);
});

test("terminate hint is shown next to the name", () => {
  const line = cell(
    {
      name: "Terminate Pixel_9_API_36",
      value: "x",
      hint: "[skip the fast boot image creation, the device will be shut down]",
    },
    0,
    0,
    120,
  );
  assert.match(
    stripAnsi(line),
    /Terminate Pixel_9_API_36 \[skip the fast boot image creation, the device will be shut down\]/,
  );
});

test("running summary is annotated instead of [running] on the name", () => {
  const line = cell(
    { name: "Android", value: "android", runningSummary: { running: 1, total: 3 } },
    0,
    0,
    80,
  );
  assert.match(stripAnsi(line), /Android \[running: 1\/3\]/);
});

test("scripted c closes a running device", async () => {
  const running = { name: "Pixel_9_API_36", value: "Pixel_9_API_36", running: true };
  const chosen = await prompt([running, { name: "Create new device", value: "x", create: true }], {
    keys: ["close"],
    closeable: true,
  });
  assert.equal(isCloseRequest(chosen), true);
  if (isCloseRequest(chosen)) {
    assert.equal(chosen.item, running);
  }
});

test("scripted hold stops on the current menu without choosing", async () => {
  await assert.rejects(
    () =>
      prompt(
        [
          { name: "Android", value: "android", runningSummary: { running: 1, total: 3 } },
          { name: "iOS", value: "ios", runningSummary: { running: 0, total: 2 } },
        ],
        { keys: ["hold"] },
      ),
    /hold/,
  );
});

test("scripted c is ignored unless the selected device is running", async () => {
  await assert.rejects(
    () =>
      prompt([{ name: "Pixel_9_API_36", value: "Pixel_9_API_36" }], {
        keys: ["close"],
        closeable: true,
      }),
    /Scripted keys ended without Enter/,
  );
});
