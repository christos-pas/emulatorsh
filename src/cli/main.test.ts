import assert from "node:assert/strict";
import { test } from "node:test";

import { BACK, CLOSE_SUSPEND, CLOSE_TERMINATE, ORANGE, RESET, SIMULATE_NOTE } from "../sdk/constants";
import type { MenuItem } from "../sdk/types";
import { closeRequest } from "./close";
import { closedMessage, main, startedMessage } from "./main";
import type { Runtime } from "./runtime";

test("create/run confirmation stays plain outside simulate", () => {
  assert.equal(startedMessage("Pixel_9_API_36 (pid 1, detached).", false), "Started Pixel_9_API_36 (pid 1, detached).");
});

test("create/run confirmation adds the orange simulation note", () => {
  assert.equal(
    startedMessage("Pixel_9_API_36 (pid 1, detached).", true),
    `Started Pixel_9_API_36 (pid 1, detached). ${ORANGE}${SIMULATE_NOTE}${RESET}`,
  );
});

test("close confirmation stays plain outside simulate", () => {
  assert.equal(
    closedMessage("terminate", "Pixel_9_API_36", false),
    "Termination command sent to Pixel_9_API_36",
  );
});

test("close confirmation adds the orange simulation note", () => {
  assert.equal(
    closedMessage("suspend", "iPhone 16", true),
    `Suspension command sent to iPhone 16 ${ORANGE}${SIMULATE_NOTE}${RESET}`,
  );
});

function mockRuntime(overrides: Partial<Runtime>): Runtime {
  return {
    listAndroidAvds: () => [],
    listIosSimulators: () => [],
    listWatchSimulators: () => [],
    listInstalledSystemImages: () => [],
    listAvailableSystemImages: () => [],
    listDeviceProfiles: () => [],
    installSystemImage: async () => undefined,
    createAvd: () => "",
    startAndroid: () => 1,
    startIos: () => 1,
    suspendDevice: () => undefined,
    terminateDevice: () => undefined,
    pick: async () => BACK,
    write: () => undefined,
    log: () => undefined,
    error: () => undefined,
    exit: () => undefined,
    ...overrides,
  };
}

test("terminating a running device exits the cli", async () => {
  const device: MenuItem = { name: "Pixel_9_API_36", value: "Pixel_9_API_36", running: true };
  const create: MenuItem = { name: "Create new device", value: "__create__", create: true };
  const actions: string[] = [];
  const logs: string[] = [];

  await main(
    mockRuntime({
      listAndroidAvds: () => [device, create],
      terminateDevice(item) {
        actions.push(`terminate:${item.name}`);
        device.running = false;
      },
      async pick(title, items) {
        if (title === "Select a platform") {
          return items[0]!;
        }
        if (title === "Close Pixel_9_API_36") {
          return items.find((item) => item.value === CLOSE_TERMINATE)!;
        }
        if (title === "Select an emulator") {
          return closeRequest(device);
        }
        throw new Error(`Unexpected pick: ${title}`);
      },
      log(text) {
        logs.push(text);
      },
      exit() {
        actions.push("exit");
      },
    }),
  );

  assert.deepEqual(actions, ["terminate:Pixel_9_API_36"]);
  assert.equal(logs[0], "Termination command sent to Pixel_9_API_36");
  assert.equal(device.running, false);
});

test("suspending a running device exits the cli", async () => {
  const device: MenuItem = { name: "Pixel_9_API_36", value: "Pixel_9_API_36", running: true };
  const actions: string[] = [];

  await main(
    mockRuntime({
      listAndroidAvds: () => [
        device,
        { name: "Create new device", value: "__create__", create: true },
      ],
      suspendDevice(item) {
        actions.push(`suspend:${item.name}`);
        device.running = false;
      },
      async pick(title, items) {
        if (title === "Select a platform") {
          return items[0]!;
        }
        if (title === "Close Pixel_9_API_36") {
          return items.find((item) => item.value === CLOSE_SUSPEND)!;
        }
        if (title === "Select an emulator") {
          return closeRequest(device);
        }
        throw new Error(`Unexpected pick: ${title}`);
      },
      exit() {
        actions.push("exit");
      },
    }),
  );

  assert.deepEqual(actions, ["suspend:Pixel_9_API_36"]);
});

test("backing out of close confirmation does not stop the device", async () => {
  const device: MenuItem = { name: "Pixel_9_API_36", value: "Pixel_9_API_36", running: true };
  const stopped: string[] = [];
  let picks = 0;

  await main(
    mockRuntime({
      listAndroidAvds: () => [
        device,
        { name: "Create new device", value: "__create__", create: true },
      ],
      suspendDevice(item) {
        stopped.push(`suspend:${item.name}`);
      },
      terminateDevice(item) {
        stopped.push(`terminate:${item.name}`);
      },
      async pick(title, items) {
        picks += 1;
        if (title === "Select a platform") {
          return picks === 1 ? items[0]! : BACK;
        }
        if (title === "Close Pixel_9_API_36") {
          return BACK;
        }
        if (title === "Select an emulator") {
          return picks === 2 ? closeRequest(device) : BACK;
        }
        return BACK;
      },
    }),
  );

  assert.deepEqual(stopped, []);
  assert.equal(device.running, true);
});
