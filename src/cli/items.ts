import { helpers } from "../sdk";
import { CREATE_VALUE, INSTALL_SDK_VALUE } from "./constants";
import type { AndroidDevice, AppleDevice, DeviceProfile, Platform, PlatformName, SystemImage } from "../sdk/types";
import type { MenuItem } from "./types";

const PLATFORM_LABEL: Record<PlatformName, string> = {
  android: "Android",
  ios: "iOS",
  watchos: "watchOS",
};

export function installSdkOption(): MenuItem {
  return {
    name: "Install new SDK",
    value: INSTALL_SDK_VALUE,
    installSdk: true,
    accent: "purple",
  };
}

export function createNewDeviceOption(): MenuItem {
  return {
    name: "Create new device",
    value: CREATE_VALUE,
    create: true,
    accent: "purple",
  };
}

export function platformToItem(platform: Platform): MenuItem {
  return {
    name: PLATFORM_LABEL[platform.name],
    value: platform.name,
    runningSummary: { running: platform.running, total: platform.installed },
  };
}

export function androidToItem(device: AndroidDevice): MenuItem {
  return {
    name: device.name,
    value: device.name,
    running: device.running,
  };
}

export function appleToItem(device: AppleDevice): MenuItem {
  return {
    name: helpers.appleDisplayName(device),
    value: device.id,
    running: device.running,
  };
}

export function imageToItem(image: SystemImage): MenuItem {
  return {
    name: image.name,
    value: image.package,
    package: image.package,
    api: image.api,
    sysdir: image.sysdir,
    installed: image.installed,
  };
}

export function imageFromItem(item: MenuItem): SystemImage {
  if (!item.package || !item.api) {
    throw new Error("Selected SDK is missing a package id.");
  }
  return {
    name: item.name,
    package: item.package,
    api: item.api,
    sysdir: item.sysdir,
    installed: item.installed,
  };
}

export function profileToItem(profile: DeviceProfile): MenuItem {
  return {
    name: profile.name,
    value: profile.id,
    avdName: profile.avdName,
    installedCount: profile.installedCount,
  };
}
