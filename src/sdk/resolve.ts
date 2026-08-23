import { isAppleDeviceId } from "./apple/id";
import { listAppleSimulators } from "./apple/simulators";
import type { AppleOs } from "./apple/runtime";
import { listAndroidAvds } from "./android/avds";
import { EmulatorshError, ErrorCode } from "./errors";
import type { AndroidDevice, AndroidRef, AppleDevice, AppleRef, ImageRef } from "./types";
import type { System } from "../system";

export function androidNameOf(ref: AndroidRef): string {
  const name = (typeof ref === "string" ? ref : ref.name).trim();
  if (!name) {
    throw new EmulatorshError(ErrorCode.DEVICE_NOT_FOUND, "Missing Android device name.");
  }
  return name;
}

export function resolveAndroidDevice(system: System, ref: AndroidRef): AndroidDevice {
  const name = androidNameOf(ref);
  const found = listAndroidAvds(system).find((device) => device.name === name);
  if (!found) {
    throw new EmulatorshError(ErrorCode.DEVICE_NOT_FOUND, `No Android device named ${name}.`);
  }
  return found;
}

export function imagePackageOf(ref: ImageRef): string {
  const pkg = (typeof ref === "string" ? ref : ref.package).trim();
  if (!pkg) {
    throw new EmulatorshError(ErrorCode.DEVICE_NOT_FOUND, "Missing system image package.");
  }
  return pkg;
}

export function appleDisplayName(device: Pick<AppleDevice, "name" | "runtime">): string {
  return device.runtime ? `${device.name} (${device.runtime})` : device.name;
}

function appleQuery(ref: AppleRef): string {
  if (typeof ref === "string") {
    return ref.trim();
  }
  if ("id" in ref && ref.id.trim()) {
    return ref.id.trim();
  }
  if ("name" in ref) {
    return ref.name.trim();
  }
  return "";
}

function appleMatches(device: AppleDevice, query: string): boolean {
  const needle = query.toLowerCase();
  return (
    device.id.toLowerCase() === needle ||
    device.name.toLowerCase() === needle ||
    appleDisplayName(device).toLowerCase() === needle
  );
}

export function resolveAppleDevice(
  system: System,
  os: AppleOs,
  ref: AppleRef,
  options: { listed?: boolean } = {},
): AppleDevice {
  const query = appleQuery(ref);
  if (!query) {
    throw new EmulatorshError(ErrorCode.DEVICE_NOT_FOUND, "Missing iOS / watchOS device name or UDID.");
  }

  const devices = listAppleSimulators(system, os);
  const matches = devices.filter((device) => appleMatches(device, query));
  if (matches.length === 1 && matches[0]) {
    return matches[0];
  }
  if (matches.length > 1) {
    const names = matches.map((device) => appleDisplayName(device)).join(", ");
    throw new EmulatorshError(
      ErrorCode.DEVICE_AMBIGUOUS,
      `Several devices match "${query}": ${names}. Pass a UDID or a name with its runtime.`,
    );
  }
  if (!options.listed && isAppleDeviceId(query)) {
    return { name: query, id: query, running: false, runtime: "" };
  }
  const kind = os === "watchos" ? "watchOS" : "iOS";
  throw new EmulatorshError(ErrorCode.DEVICE_NOT_FOUND, `No ${kind} device named ${query}.`);
}
