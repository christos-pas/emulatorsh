import assert from "node:assert/strict";
import { test } from "node:test";

import { isCloseRequest } from "../close";
import { MENU_REFRESH_MAX_MS, MENU_REFRESH_MS } from "../constants";
import { cell, menusEqual, nextRefreshDelay, prompt, selectionAfterRefresh, stripAnsi } from "./prompt";

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

test("menu refresh delay grows by 500ms and stops at 10s", () => {
  assert.equal(nextRefreshDelay(MENU_REFRESH_MS), 2000);
  assert.equal(nextRefreshDelay(9500), MENU_REFRESH_MAX_MS);
  assert.equal(nextRefreshDelay(MENU_REFRESH_MAX_MS), MENU_REFRESH_MAX_MS);
});

test("menusEqual ignores object identity and watches running counts", () => {
  const android = { name: "Android", value: "android", runningSummary: { running: 0, total: 11 } };
  assert.equal(
    menusEqual([android], [{ ...android, runningSummary: { running: 0, total: 11 } }]),
    true,
  );
  assert.equal(
    menusEqual([android], [{ ...android, runningSummary: { running: 1, total: 11 } }]),
    false,
  );
});

test("selectionAfterRefresh keeps the same value when counts change", () => {
  const previous = [
    { name: "Android", value: "android", runningSummary: { running: 0, total: 11 } },
    { name: "iOS", value: "ios", runningSummary: { running: 0, total: 2 } },
  ];
  const next = [
    { name: "Android", value: "android", runningSummary: { running: 1, total: 11 } },
    { name: "iOS", value: "ios", runningSummary: { running: 0, total: 2 } },
  ];
  assert.equal(selectionAfterRefresh(previous, 1, next), 1);
  assert.equal(
    selectionAfterRefresh(previous, 0, [{ name: "watchOS", value: "watchos" }]),
    0,
  );
});

test("scripted prompt ignores refresh so GIF and tests stay one-shot", async () => {
  let ticks = 0;
  const chosen = await prompt(
    [{ name: "Android", value: "android", runningSummary: { running: 0, total: 1 } }],
    {
      keys: ["enter"],
      refresh: () => {
        ticks += 1;
        return [{ name: "Android", value: "android", runningSummary: { running: 1, total: 1 } }];
      },
    },
  );
  assert.equal(isCloseRequest(chosen), false);
  if (!isCloseRequest(chosen)) {
    assert.equal(chosen.value, "android");
  }
  assert.equal(ticks, 0);
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
