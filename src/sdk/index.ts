import { createAvd, listAndroidAvds } from "./android/avds";
import {
  installSystemImage,
  listAvailableSystemImages,
  listInstalledSystemImages,
} from "./android/images";
import { listDeviceProfiles } from "./android/profiles";
import { listIosSimulators, listWatchSimulators } from "./apple/simulators";
import { EmulatorshError } from "./errors";
import { suspendDevice, terminateDevice } from "./power";
import { startAndroid, startIos } from "./start";
import type { FormFactor, MenuItem, SystemImage } from "./types";
import { bindSystem, type System } from "../system";

export interface EmulatorshOptions {
  system: System;
}

export interface Emulatorsh {
  android: {
    list(): MenuItem[];
    start(device: MenuItem): number;
    create(image: SystemImage, profile: MenuItem): string;
    suspend(device: MenuItem): void;
    terminate(device: MenuItem): void;
    images: {
      listInstalled(formFactor: FormFactor): SystemImage[];
      listAvailable(formFactor: FormFactor): SystemImage[];
      install(pkg: string): Promise<void>;
    };
    profiles: {
      list(image: SystemImage, formFactor: FormFactor): MenuItem[];
    };
  };
  ios: {
    list(): MenuItem[];
    start(device: MenuItem): number;
    suspend(device: MenuItem): void;
  };
  watchos: {
    list(): MenuItem[];
    start(device: MenuItem): number;
    suspend(device: MenuItem): void;
  };
}

export function createEmulatorsh(options: EmulatorshOptions): Emulatorsh {
  bindSystem(options.system);
  return {
    android: {
      list: () => listAndroidAvds().filter((item) => !item.create),
      start: startAndroid,
      create: createAvd,
      suspend: suspendDevice,
      terminate: terminateDevice,
      images: {
        listInstalled: listInstalledSystemImages,
        listAvailable: listAvailableSystemImages,
        install: installSystemImage,
      },
      profiles: {
        list: listDeviceProfiles,
      },
    },
    ios: {
      list: listIosSimulators,
      start: startIos,
      suspend: suspendDevice,
    },
    watchos: {
      list: listWatchSimulators,
      start: startIos,
      suspend: suspendDevice,
    },
  };
}

export { EmulatorshError };
export type { FormFactor, MenuItem, SystemImage };
