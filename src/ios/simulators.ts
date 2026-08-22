import type { MenuItem } from "../types.js";
import { runFile } from "../host/exec.js";
import {
  appleRuntimeFromKey,
  iosVersionFromRuntime,
  type AppleOs,
} from "./runtime.js";

export {
  appleDeviceLabel,
  appleRuntimeFromKey,
  iosVersionFromRuntime,
  watchOsVersionFromRuntime,
} from "./runtime.js";

interface SimctlDevice {
  isAvailable?: boolean;
  udid?: string;
  name?: string;
  state?: string;
}

interface SimctlList {
  devices?: Record<string, SimctlDevice[]>;
}

export function listIosSimulators(): MenuItem[] {
  return listAppleSimulators("ios");
}

export function listWatchSimulators(): MenuItem[] {
  return listAppleSimulators("watchos");
}

export function listAppleSimulators(os: AppleOs): MenuItem[] {
  try {
    const raw = runFile("xcrun", ["simctl", "list", "devices", "available", "-j"], {
      encoding: "utf8",
    });
    const parsed = JSON.parse(raw) as SimctlList;
    const devices: MenuItem[] = [];
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
          name: `${device.name} (${runtime.label} ${runtime.version})`,
          value: device.udid,
          running: device.state === "Booted",
        });
      }
    }
    return devices;
  } catch {
    return [];
  }
}
