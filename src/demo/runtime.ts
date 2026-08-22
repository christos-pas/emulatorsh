import { proposedAvdName, sanitizeAvdName } from "../android/format.js";
import { profileSupportsImage, sysdirMatchesImage } from "../android/specs.js";
import { BACK } from "../constants.js";
import type { FormFactor, MenuItem } from "../types.js";
import { prompt, type RenderFrame, type ScriptedKey } from "../ui/prompt.js";
import { isAppleDeviceId } from "../devices/close.js";
import { suspendHeading, suspendProgressBar } from "../devices/suspend-progress.js";
import { menuHeading, type Runtime } from "../runtime.js";
import { DEMO, DEMO_PIDS, createDemoCatalog, type DemoCatalog } from "./data.js";

export type DemoFrame =
  | {
      kind: "menu";
      windowTitle: string;
      heading: string;
      items: MenuItem[];
      selected: number;
      lines: string[];
      delay: number;
    }
  | {
      kind: "output";
      windowTitle: string;
      lines: { text: string; fill?: string }[];
      caret?: boolean;
      delay: number;
    };

const DELAY_SCALE = 1.3;
const DELAY = {
  first: 0.55,
  move: 0.13,
  last: 0.42,
  output: 0.7,
  progress: 0.16,
  success: 1.8,
};

function scaled(seconds: number): number {
  return seconds * DELAY_SCALE;
}

function sdkBar(percent: number): string {
  const width = 38;
  const filled = Math.round((width * percent) / 100);
  const bar = `${"=".repeat(filled)}${" ".repeat(width - filled)}`;
  const mb = Math.round((362 * percent) / 100);
  return `[${bar}] ${String(percent).padStart(3)}%   ${mb} MB / 362 MB`;
}

function markDemoDeviceStopped(catalog: DemoCatalog, device: MenuItem): void {
  device.running = false;
  for (const list of [catalog.android, catalog.ios, catalog.watchos]) {
    const listed = list.find((item) => item.value === device.value);
    if (listed) {
      listed.running = false;
    }
  }
}

function findImage(catalog: DemoCatalog, pkg: string) {
  for (const formFactor of ["phone", "wear"] as const satisfies FormFactor[]) {
    const image = catalog.available[formFactor].find((item) => item.package === pkg);
    if (image) {
      return { formFactor, image };
    }
  }
  return undefined;
}

export function createDemoRuntime(options: {
  catalog: DemoCatalog;
  windowTitle: { current: string };
  keyQueue: ScriptedKey[][];
  frames: DemoFrame[];
}): Runtime {
  const { catalog, windowTitle, keyQueue, frames } = options;

  const pushMenu = (heading: string, items: MenuItem[], frame: RenderFrame) => {
    const delay = frame.index === 0 ? DELAY.first : frame.last ? DELAY.last : DELAY.move;
    frames.push({
      kind: "menu",
      windowTitle: windowTitle.current,
      heading,
      items,
      selected: frame.selected,
      lines: frame.lines,
      delay: scaled(delay),
    });
  };

  const pushOutput = (
    lines: { text: string; fill?: string }[],
    delay = DELAY.output,
    caret = false,
  ) => {
    frames.push({
      kind: "output",
      windowTitle: windowTitle.current,
      lines,
      caret,
      delay: scaled(delay),
    });
  };

  return {
    listAndroidAvds: () => catalog.android,
    listIosSimulators: () => catalog.ios,
    listWatchSimulators: () => catalog.watchos,
    listInstalledSystemImages: (formFactor) => catalog.installed[formFactor],
    listAvailableSystemImages: (formFactor) => catalog.available[formFactor],
    listDeviceProfiles: (image, formFactor) =>
      catalog.profiles[formFactor]
        .filter((profile) => profileSupportsImage(profile.supportedSdks, image))
        .map((profile) => ({
          name: profile.name,
          value: profile.value,
          avdName: sanitizeAvdName(profile.name, image.api),
          supportedSdks: profile.supportedSdks,
          installedCount: DEMO.androidAvds.filter(
            (avd) => avd.deviceName === profile.value && sysdirMatchesImage(avd.sysdir, image),
          ).length,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    async installSystemImage(pkg, label) {
      const found = findImage(catalog, pkg);
      const name = label ?? found?.image.name ?? pkg;
      pushOutput(
        [
          { text: `Installing ${name}...` },
          { text: "" },
          { text: "Do you accept the license 'android-sdk-license' [y/n]: y", fill: "#a6adc8" },
        ],
        0.35,
      );
      for (const percent of [6, 14, 23, 35, 47, 58, 71, 83, 92, 100]) {
        pushOutput(
          [
            { text: `Installing ${name}...` },
            { text: "" },
            { text: `Downloading ${pkg}`, fill: "#a6adc8" },
            { text: sdkBar(percent), fill: "#00d7d7" },
          ],
          DELAY.progress,
        );
      }
      pushOutput(
        [
          { text: `Installing ${name}...` },
          { text: "" },
          { text: "Unzipping...", fill: "#a6adc8" },
          { text: `[${"=".repeat(16)}${" ".repeat(22)}]  42%`, fill: "#00d7d7" },
        ],
        0.22,
      );
      pushOutput(
        [
          { text: `Installing ${name}...` },
          { text: "" },
          { text: "Unzipping...", fill: "#a6adc8" },
          { text: `[${"=".repeat(38)}] 100%`, fill: "#00d7d7" },
        ],
        0.22,
      );
      if (found && !catalog.installed[found.formFactor].some((image) => image.package === pkg)) {
        const { installed: _installed, ...rest } = found.image;
        catalog.installed[found.formFactor].unshift(rest);
        found.image.installed = true;
      }
      pushOutput([{ text: `Installed ${name}.`, fill: "#a6e3a1" }], 0.7);
    },
    createAvd(image, device) {
      const taken = catalog.android.filter((item) => !item.create).map((item) => item.name);
      return proposedAvdName(device.name, image.api, taken);
    },
    startAndroid(device) {
      const existing = catalog.android.find((item) => item.value === device.value);
      if (existing) {
        existing.running = true;
      } else {
        catalog.android.unshift({
          name: device.name,
          value: device.value,
          running: true,
        });
      }
      return DEMO_PIDS.android;
    },
    startIos(device) {
      device.running = true;
      return DEMO_PIDS.ios;
    },
    async suspendDevice(device) {
      if (!isAppleDeviceId(device.value)) {
        pushOutput([{ text: suspendHeading(device.name), fill: "#4ea8ff" }], 0.35);
        pushOutput([{ text: suspendProgressBar(100), fill: "#4ea8ff" }], 0.55);
      }
      markDemoDeviceStopped(catalog, device);
    },
    terminateDevice(device) {
      markDemoDeviceStopped(catalog, device);
    },
    async pick(title, items, options) {
      const keys = keyQueue.shift();
      if (!keys) {
        throw new Error(`Demo ran out of key sequences at "${title}".`);
      }
      const heading = menuHeading(title, items, options);
      try {
        return await prompt(items, {
          keys,
          selected: options?.selected,
          closeable: options?.closeable,
          onRender: (frame) => pushMenu(heading, items, frame),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "back") {
          return BACK;
        }
        throw error;
      }
    },
    write(text) {
      const trimmed = text.replace(/\n+$/, "");
      if (!trimmed) {
        return;
      }
      pushOutput([{ text: trimmed, fill: "#a6adc8" }], 0.7);
    },
    log(text) {
      pushOutput([{ text }, { text: "" }, { text: "$ " }], DELAY.success, true);
    },
    error(text) {
      throw new Error(text);
    },
    exit(code) {
      throw new Error(`Demo runtime exit(${code})`);
    },
  };
}

export { createDemoCatalog };
