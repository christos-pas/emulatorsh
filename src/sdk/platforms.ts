import { listAndroidAvds } from "./android/avds";
import { listIosSimulators, listWatchSimulators } from "./apple/simulators";
import type { Platform, PlatformName } from "./types";
import type { System } from "../system";

function counts(name: PlatformName, devices: { running: boolean }[]): Platform {
  return {
    name,
    installed: devices.length,
    running: devices.filter((device) => device.running).length,
  };
}

export function listPlatforms(system: System): Platform[] {
  return [
    counts("android", listAndroidAvds(system)),
    counts("ios", listIosSimulators(system)),
    counts("watchos", listWatchSimulators(system)),
  ];
}
