import { CLOSE_BACK, CLOSE_SUSPEND, CLOSE_TERMINATE } from "../constants.js";
import type { MenuItem } from "../types.js";

export const CLOSE = Symbol("close");

export type CloseRequest = {
  readonly [CLOSE]: true;
  item: MenuItem;
};

export function isCloseRequest(value: unknown): value is CloseRequest {
  return Boolean(value && typeof value === "object" && CLOSE in value);
}

export function canCloseItem(item: MenuItem | undefined): item is MenuItem {
  return Boolean(item?.running) && !item?.create && !item?.installSdk && !item?.runningSummary;
}

export function closeRequest(item: MenuItem): CloseRequest {
  return { [CLOSE]: true, item };
}

export function closeConfirmationItems(device: MenuItem): MenuItem[] {
  const name = device.name;
  const items: MenuItem[] = [
    { name: "Back", value: CLOSE_BACK },
    { name: `Suspend ${name}`, value: CLOSE_SUSPEND },
  ];
  if (!isAppleDeviceId(device.value)) {
    items.push({
      name: `Terminate ${name}`,
      value: CLOSE_TERMINATE,
      hint: "[skip the fast boot image creation, the device will be shut down]",
    });
  }
  return items;
}

const UDID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

export function isAppleDeviceId(value: string): boolean {
  return UDID.test(value);
}
