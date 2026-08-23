import type { AppleDevice } from "./types";

const UDID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

export function isAppleDeviceId(value: string): boolean {
  return UDID.test(value);
}

export function appleDisplayName(device: Pick<AppleDevice, "name" | "runtime">): string {
  return device.runtime ? `${device.name} (${device.runtime})` : device.name;
}

export const helpers = {
  isAppleDeviceId,
  appleDisplayName,
};
