import { createAvd, listAndroidAvds } from "../sdk/android/avds";
import {
  installSystemImage,
  listAvailableSystemImages,
  listInstalledSystemImages,
} from "../sdk/android/images";
import { listDeviceProfiles } from "../sdk/android/profiles";
import { isAppleDeviceId } from "../sdk/apple/id";
import { listIosSimulators, listWatchSimulators } from "../sdk/apple/simulators";
import { BACK, BLUE, ORANGE, PAGE_SIZE, RESET, SIMULATE_BANNER } from "../sdk/constants";
import { suspendDevice, terminateDevice } from "../sdk/power";
import { startAndroid, startIos } from "../sdk/start";
import type { FormFactor, MenuItem, SystemImage } from "../sdk/types";
import { isSandbox } from "../system/context";
import type { CloseRequest } from "./close";
import { playSimulateSdkInstall } from "./ui/install-progress";
import { prompt, useTwoColumns, type PromptOptions, type ScriptedKey } from "./ui/prompt";
import { playSuspendProgress } from "./ui/suspend-progress";

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
      if (isSandbox()) {
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
      if (isSandbox()) {
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
