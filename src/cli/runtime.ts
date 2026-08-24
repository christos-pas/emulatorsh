import { createEmulatorsh } from "../sdk";
import { BACK, BLUE, ORANGE, PAGE_SIZE, RESET, SIMULATE_BANNER } from "./constants";
import type { DeviceProfile, FormFactor, SystemImage } from "../sdk/types";
import type { MenuItem } from "./types";
import type { System } from "../system/types";
import { androidToItem, appleToItem, createNewDeviceOption, imageToItem, platformToItem, profileToItem } from "./items";
import type { CloseRequest } from "./close";
import { playSimulateSdkInstall } from "./ui/install-progress";
import { prompt, useTwoColumns, type PromptOptions, type ScriptedKey } from "./ui/prompt";
import { playSuspendProgress } from "./ui/suspend-progress";

export interface PickOptions {
  selected?: number;
  closeable?: boolean;
  refresh?: () => MenuItem[];
}

export interface LiveRuntimeOptions {
  sticky?: boolean;
}

export interface Runtime {
  readonly simulate: boolean;
  readonly sticky: boolean;
  listPlatforms(): MenuItem[];
  listAndroidAvds(): MenuItem[];
  listIosSimulators(): MenuItem[];
  listWatchSimulators(): MenuItem[];
  listInstalledSystemImages(formFactor: FormFactor): MenuItem[];
  listAvailableSystemImages(formFactor: FormFactor): MenuItem[];
  listDeviceProfiles(image: SystemImage): MenuItem[];
  installSystemImage(pkg: string, label?: string): Promise<void>;
  createAvd(image: SystemImage, device: MenuItem): Promise<string>;
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

export function createLiveRuntime(
  system: System,
  promptOptions: PromptOptions = {},
  options: LiveRuntimeOptions = {},
): Runtime {
  const emulatorsh = createEmulatorsh({ system });
  return {
    simulate: system.kind === "sandbox",
    sticky: Boolean(options.sticky),
    listPlatforms: () => emulatorsh.platforms.list().map(platformToItem),
    listAndroidAvds: () => [...emulatorsh.android.list().map(androidToItem), createNewDeviceOption()],
    listIosSimulators: () => emulatorsh.ios.list().map(appleToItem),
    listWatchSimulators: () => emulatorsh.watchos.list().map(appleToItem),
    listInstalledSystemImages: (formFactor) =>
      emulatorsh.android.images.listInstalled(formFactor).map(imageToItem),
    listAvailableSystemImages: (formFactor) =>
      emulatorsh.android.images.listAvailable(formFactor).map(imageToItem),
    listDeviceProfiles: (image) => emulatorsh.android.profiles.list(image).map(profileToItem),
    async installSystemImage(pkg, label) {
      const name = label || pkg;
      process.stdout.write(`\nInstalling ${name}...\n`);
      if (system.kind === "sandbox") {
        await playSimulateSdkInstall(pkg);
      }
      await emulatorsh.android.images.install(pkg);
      process.stdout.write(`\nInstalled ${name}.\n`);
    },
    async createAvd(image, device) {
      const created = await emulatorsh.android.create(image, menuProfile(device));
      return created.name;
    },
    startAndroid: (device) => emulatorsh.android.start(device.value),
    startIos: (device) => emulatorsh.ios.start({ id: device.value }),
    async suspendDevice(device) {
      const suspend = () => {
        if (emulatorsh.helpers.isAppleDeviceId(device.value)) {
          emulatorsh.ios.suspend({ id: device.value });
          return;
        }
        emulatorsh.android.suspend(device.value);
      };
      if (emulatorsh.helpers.isAppleDeviceId(device.value)) {
        suspend();
        return;
      }
      await playSuspendProgress(device.name, {
        onStart: suspend,
      });
    },
    terminateDevice: (device) => emulatorsh.android.terminate(device.value),
    async pick(title, items, options) {
      const heading = menuHeading(title, items, options);
      if (system.kind === "sandbox") {
        process.stdout.write(`${ORANGE}${SIMULATE_BANNER}${RESET}\n`);
      }
      process.stdout.write(`${heading}\n\n`);
      try {
        return await prompt(items, {
          ...promptOptions,
          selected: options?.selected,
          closeable: options?.closeable,
          refresh: options?.refresh,
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

function menuProfile(device: MenuItem): DeviceProfile {
  return {
    id: device.value,
    name: device.name,
    avdName: device.avdName || device.name,
    installedCount: device.installedCount ?? 0,
  };
}
