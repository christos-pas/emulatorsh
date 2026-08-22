import { createAvd, listAndroidAvds } from "./android/avds.js";
import {
  installSystemImage,
  listAvailableSystemImages,
  listInstalledSystemImages,
} from "./android/images.js";
import { listDeviceProfiles } from "./android/profiles.js";
import { BACK, BLUE, ORANGE, PAGE_SIZE, RESET, SIMULATE_BANNER } from "./constants.js";
import { playSimulateSdkInstall } from "./demo/install-progress.js";
import { isSimulate } from "./demo/mode.js";
import { isAppleDeviceId } from "./devices/close.js";
import type { CloseRequest } from "./devices/close.js";
import { suspendDevice, terminateDevice } from "./devices/power.js";
import { playSuspendProgress } from "./devices/suspend-progress.js";
import { listIosSimulators, listWatchSimulators } from "./ios/simulators.js";
import { startAndroid, startIos } from "./start.js";
import type { FormFactor, MenuItem, SystemImage } from "./types.js";
import { prompt, useTwoColumns, type PromptOptions, type ScriptedKey } from "./ui/prompt.js";

export interface PickOptions {
  selected?: number;
  closeable?: boolean;
}

export interface Runtime {
  listAndroidAvds(): MenuItem[];
  listIosSimulators(): MenuItem[];
  listWatchSimulators(): MenuItem[];
  listInstalledSystemImages(formFactor: FormFactor): SystemImage[];
  listAvailableSystemImages(formFactor: FormFactor): SystemImage[];
  listDeviceProfiles(image: SystemImage, formFactor: FormFactor): MenuItem[];
  installSystemImage(pkg: string, label?: string): Promise<void>;
  createAvd(image: SystemImage, device: MenuItem): string;
  startAndroid(device: MenuItem): number;
  startIos(device: MenuItem): number;
  suspendDevice(device: MenuItem): void | Promise<void>;
  terminateDevice(device: MenuItem): void;
  pick(
    title: string,
    items: MenuItem[],
    options?: PickOptions,
  ): Promise<MenuItem | typeof BACK | CloseRequest>;
  write(text: string): void;
  log(text: string): void;
  error(text: string): void;
  exit(code: number): void;
}

export function menuHeading(
  title: string,
  items: MenuItem[],
  options?: PickOptions,
): string {
  const extra = [
    useTwoColumns(items.length) ? "←/→" : "",
    items.length > PAGE_SIZE ? "↓ more pages" : "",
  ]
    .filter(Boolean)
    .join(", ");
  const hints = extra ? `, ${extra}` : "";
  const close = options?.closeable
    ? `, ${BLUE}c to close the selected device${RESET}`
    : "";
  return `${title} (↑/↓${hints}, Enter, Esc back, q to cancel${close})`;
}

export function runningSummary(devices: MenuItem[]): { running: number; total: number } {
  const real = devices.filter((device) => !device.create);
  return {
    running: real.filter((device) => device.running).length,
    total: real.length,
  };
}

export function createLiveRuntime(promptOptions: PromptOptions = {}): Runtime {
  return {
    listAndroidAvds,
    listIosSimulators,
    listWatchSimulators,
    listInstalledSystemImages,
    listAvailableSystemImages,
    listDeviceProfiles,
    async installSystemImage(pkg, label) {
      const name = label || pkg;
      process.stdout.write(`\nInstalling ${name}...\n`);
      if (isSimulate()) {
        await playSimulateSdkInstall(pkg);
      }
      await installSystemImage(pkg);
      process.stdout.write(`\nInstalled ${name}.\n`);
    },
    createAvd,
    startAndroid,
    startIos,
    async suspendDevice(device) {
      if (isAppleDeviceId(device.value)) {
        suspendDevice(device);
        return;
      }
      await playSuspendProgress(device.name, {
        onStart: () => {
          suspendDevice(device);
        },
      });
    },
    terminateDevice,
    async pick(title, items, options) {
      const heading = menuHeading(title, items, options);
      if (isSimulate()) {
        process.stdout.write(`${ORANGE}${SIMULATE_BANNER}${RESET}\n`);
      }
      process.stdout.write(`${heading}\n\n`);
      try {
        return await prompt(items, {
          ...promptOptions,
          selected: options?.selected,
          closeable: options?.closeable,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "back") {
          return BACK;
        }
        if (message === "cancelled") {
          console.log("Cancelled.");
          process.exit(0);
        }
        console.error(message);
        process.exit(1);
      }
    },
    write(text) {
      process.stdout.write(text);
    },
    log(text) {
      console.log(text);
    },
    error(text) {
      console.error(text);
    },
    exit(code) {
      process.exit(code);
    },
  };
}

export type { ScriptedKey };
