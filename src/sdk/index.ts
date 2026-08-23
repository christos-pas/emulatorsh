import { listAndroidAvds } from "./android/avds";
import { createFromRefs, type CreateOptions } from "./android/create";
import {
  installSystemImage,
  listAvailableSystemImages,
  listInstalledSystemImages,
} from "./android/images";
import { listDeviceProfiles } from "./android/profiles";
import { listIosSimulators, listWatchSimulators } from "./apple/simulators";
import { EmulatorshError } from "./errors";
import { helpers } from "./helpers";
import { listPlatforms } from "./platforms";
import { suspendAndroid, suspendApple, terminateAndroid } from "./power";
import {
  androidNameOf,
  imagePackageOf,
  resolveAndroidDevice,
  resolveAppleDevice,
} from "./resolve";
import { startAndroid, startIos } from "./start";
import type {
  AndroidDevice,
  AndroidRef,
  AppleDevice,
  AppleRef,
  DeviceProfile,
  FormFactor,
  ImageRef,
  Platform,
  PlatformName,
  SystemImage,
} from "./types";
import type { System } from "../system";

export interface EmulatorshOptions {
  system: System;
}

export interface Emulatorsh {
  helpers: {
    isAppleDeviceId(value: string): boolean;
    appleDisplayName(device: Pick<AppleDevice, "name" | "runtime">): string;
  };
  platforms: {
    list(): Platform[];
  };
  android: {
    list(): AndroidDevice[];
    get(device: AndroidRef): AndroidDevice;
    start(device: AndroidRef): number;
    create(
      image: SystemImage | string,
      profile: DeviceProfile | string,
      options?: CreateOptions,
    ): Promise<AndroidDevice>;
    suspend(device: AndroidRef): void;
    terminate(device: AndroidRef): void;
    images: {
      listInstalled(formFactor: FormFactor): SystemImage[];
      listAvailable(formFactor: FormFactor): SystemImage[];
      install(image: ImageRef): Promise<void>;
    };
    profiles: {
      list(image: SystemImage | string): DeviceProfile[];
    };
  };
  ios: {
    list(): AppleDevice[];
    get(device: AppleRef): AppleDevice;
    start(device: AppleRef): number;
    suspend(device: AppleRef): void;
  };
  watchos: {
    list(): AppleDevice[];
    get(device: AppleRef): AppleDevice;
    start(device: AppleRef): number;
    suspend(device: AppleRef): void;
  };
}

export function createEmulatorsh(options: EmulatorshOptions): Emulatorsh {
  const { system } = options;
  return {
    helpers,
    platforms: {
      list: () => listPlatforms(system),
    },
    android: {
      list: () => listAndroidAvds(system),
      get: (device) => resolveAndroidDevice(system, device),
      start: (device) => startAndroid(system, resolveAndroidDevice(system, device).name),
      create: (image, profile, createOptions) => createFromRefs(system, image, profile, createOptions),
      suspend: (device) => suspendAndroid(system, androidNameOf(device)),
      terminate: (device) => terminateAndroid(system, androidNameOf(device)),
      images: {
        listInstalled: (formFactor) => listInstalledSystemImages(system, formFactor),
        listAvailable: (formFactor) => listAvailableSystemImages(system, formFactor),
        install: (image) => installSystemImage(system, imagePackageOf(image)),
      },
      profiles: {
        list: (image) => listDeviceProfiles(system, image),
      },
    },
    ios: {
      list: () => listIosSimulators(system),
      get: (device) => resolveAppleDevice(system, "ios", device, { listed: true }),
      start: (device) => startIos(system, resolveAppleDevice(system, "ios", device).id),
      suspend: (device) => suspendApple(system, resolveAppleDevice(system, "ios", device).id),
    },
    watchos: {
      list: () => listWatchSimulators(system),
      get: (device) => resolveAppleDevice(system, "watchos", device, { listed: true }),
      start: (device) => startIos(system, resolveAppleDevice(system, "watchos", device).id),
      suspend: (device) => suspendApple(system, resolveAppleDevice(system, "watchos", device).id),
    },
  };
}

export { EmulatorshError, helpers };
export type {
  AndroidDevice,
  AndroidRef,
  AppleDevice,
  AppleRef,
  CreateOptions,
  DeviceProfile,
  FormFactor,
  ImageRef,
  Platform,
  PlatformName,
  SystemImage,
};
