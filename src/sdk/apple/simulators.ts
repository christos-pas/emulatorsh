import type { AppleDevice } from "../types";
import { runFile } from "../../system/exec";
import type { System } from "../../system/types";
import {
  appleRuntimeFromKey,
  type AppleOs,
} from "./runtime";

export {
  appleDeviceLabel,
  appleRuntimeFromKey,
  iosVersionFromRuntime,
  watchOsVersionFromRuntime,
} from "./runtime";

interface SimctlDevice {
  isAvailable?: boolean;
  udid?: string;
  name?: string;
  state?: string;
}

interface SimctlList {
  devices?: Record<string, SimctlDevice[]>;
}

export function listIosSimulators(system: System): AppleDevice[] {
  return listAppleSimulators(system, "ios");
}

export function listWatchSimulators(system: System): AppleDevice[] {
  return listAppleSimulators(system, "watchos");
}

export function listAppleSimulators(system: System, os: AppleOs): AppleDevice[] {
  try {
    const raw = runFile(system, "xcrun", ["simctl", "list", "devices", "available", "-j"], {
      encoding: "utf8",
    });
    const parsed = JSON.parse(raw) as SimctlList;
    const devices: AppleDevice[] = [];
    for (const [runtimeKey, runtimeDevices] of Object.entries(parsed.devices || {})) {
      const runtime = appleRuntimeFromKey(runtimeKey);
      if (!runtime || runtime.os !== os) {
        continue;
      }
      for (const device of runtimeDevices) {
        if (!device.isAvailable || !device.udid || !device.name) {
          continue;
        }
        devices.push({
          name: device.name,
          id: device.udid,
          running: device.state === "Booted",
          runtime: `${runtime.label} ${runtime.version}`,
        });
      }
    }
    return devices;
  } catch {
    return [];
  }
}
