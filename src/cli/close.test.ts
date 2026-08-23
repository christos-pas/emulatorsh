import assert from "node:assert/strict";
import { test } from "node:test";

import { BLUE, CLOSE_BACK, CLOSE_SUSPEND, CLOSE_TERMINATE } from "./constants";
import { helpers } from "../sdk";
import {
  canCloseItem,
  closeConfirmationItems,
  closeRequest,
  isCloseRequest,
} from "./close";
import { menuHeading } from "./runtime";

test("only running real devices can be closed", () => {
  assert.equal(canCloseItem({ name: "Pixel_9_API_36", value: "Pixel_9_API_36", running: true }), true);
  assert.equal(canCloseItem({ name: "Pixel_9_API_36", value: "Pixel_9_API_36" }), false);
  assert.equal(
    canCloseItem({ name: "Create new device", value: "x", create: true, running: true }),
    false,
  );
  assert.equal(
    canCloseItem({ name: "Android", value: "android", runningSummary: { running: 1, total: 2 } }),
    false,
  );
});

test("close confirmation lists Back, Suspend, and Terminate", () => {
  const items = closeConfirmationItems({ name: "Pixel_9_API_36", value: "Pixel_9_API_36" });
  assert.deepEqual(
    items.map((item) => [item.name, item.value, item.hint]),
    [
      ["Back", CLOSE_BACK, undefined],
      ["Suspend Pixel_9_API_36", CLOSE_SUSPEND, undefined],
      [
        "Terminate Pixel_9_API_36",
        CLOSE_TERMINATE,
        "[skip the fast boot image creation, the device will be shut down]",
      ],
    ],
  );
});

test("Apple simulators only offer Suspend", () => {
  const items = closeConfirmationItems({
    name: "Apple Watch Series 11 (46mm) (watchOS 26.5)",
    value: "06133482-749C-4A5D-9D27-8E082984CB91",
  });
  assert.deepEqual(
    items.map((item) => [item.name, item.value]),
    [
      ["Back", CLOSE_BACK],
      ["Suspend Apple Watch Series 11 (46mm) (watchOS 26.5)", CLOSE_SUSPEND],
    ],
  );
});

test("Apple UDIDs are distinguished from AVD names", () => {
  assert.equal(helpers.isAppleDeviceId("06133482-749C-4A5D-9D27-8E082984CB91"), true);
  assert.equal(helpers.isAppleDeviceId("Pixel_9_API_36"), false);
});

test("close request is a distinct pick result", () => {
  const item = { name: "Watch", value: "udid", running: true };
  const request = closeRequest(item);
  assert.equal(isCloseRequest(request), true);
  assert.equal(isCloseRequest(item), false);
  assert.equal(request.item, item);
});

test("device list heading includes the blue close hint", () => {
  const heading = menuHeading("Select an emulator", [{ name: "Pixel", value: "p" }], {
    closeable: true,
  });
  assert.match(heading, /c to close the selected device/);
  assert.ok(heading.includes(BLUE));
  assert.doesNotMatch(menuHeading("Select a platform", []), /c to close/);
});
