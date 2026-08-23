import { EMULATOR_LOG } from "../sdk/constants";
import type { FormFactor, SystemImage } from "../sdk/types";
import type { MenuItem } from "./types";
import { closeConfirmationItems, isCloseRequest } from "./close";
import {
  BACK,
  CLOSED,
  CLOSE_BACK,
  CLOSE_SUSPEND,
  CLOSE_TERMINATE,
  NO_EMULATORS,
  NO_SDK,
  ORANGE,
  RESET,
  SIMULATE_NOTE,
} from "./constants";
import { imageFromItem, installSdkOption } from "./items";
import type { Runtime } from "./runtime";

export function startedMessage(detail: string, simulate = false): string {
  const note = simulate ? ` ${ORANGE}${SIMULATE_NOTE}${RESET}` : "";
  return `Started ${detail}${note}`;
}

export async function installSdkFlow(
  runtime: Runtime,
  formFactor: FormFactor,
): Promise<SystemImage | typeof BACK | undefined> {
  runtime.write("Fetching available SDKs...\n");
  const available = runtime.listAvailableSystemImages(formFactor);
  if (available.length === 0) {
    runtime.error("No downloadable SDKs found for this form factor.");
    return;
  }

  const selected = await runtime.pick("Select an SDK to install", available);
  if (selected === BACK || isCloseRequest(selected) || selected.installed) {
    return selected === BACK ? BACK : undefined;
  }

  try {
    const image = imageFromItem(selected);
    await runtime.installSystemImage(image.package, image.name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    runtime.error(`\nFailed to install SDK: ${message}`);
    return;
  }

  const installed = runtime.listInstalledSystemImages(formFactor);
  const match = installed.find((image) => image.package === selected.package);
  return match ? imageFromItem(match) : imageFromItem(selected);
}

function sdkPickIndex(items: MenuItem[], preferPackage?: string): number | undefined {
  if (!preferPackage) {
    return undefined;
  }
  const index = items.findIndex((item) => item.package === preferPackage || item.value === preferPackage);
  return index >= 0 ? index : undefined;
}

export async function pickInstalledSdk(
  runtime: Runtime,
  formFactor: FormFactor,
  preferPackage?: string,
): Promise<SystemImage | typeof BACK> {
  let prefer = preferPackage;
  while (true) {
    const images = runtime.listInstalledSystemImages(formFactor);
    if (images.length === 0) {
      runtime.log(`${ORANGE}${NO_SDK}${RESET}`);
    }
    const items = [...images, installSdkOption()];
    const selected = await runtime.pick("Select an SDK", items, { selected: sdkPickIndex(items, prefer) });
    if (selected === BACK || isCloseRequest(selected)) {
      return BACK;
    }
    if (!selected.installSdk) {
      return imageFromItem(selected);
    }
    const installed = await installSdkFlow(runtime, formFactor);
    if (installed === BACK) {
      continue;
    }
    if (installed) {
      return installed;
    }
    prefer = preferPackage;
  }
}

async function confirmClose(
  runtime: Runtime,
  device: MenuItem,
): Promise<"back" | "suspend" | "terminate"> {
  const selected = await runtime.pick(`Close ${device.name}`, closeConfirmationItems(device));
  if (selected === BACK || isCloseRequest(selected) || selected.value === CLOSE_BACK) {
    return "back";
  }
  if (selected.value === CLOSE_SUSPEND) {
    return "suspend";
  }
  if (selected.value === CLOSE_TERMINATE) {
    return "terminate";
  }
  return "back";
}

export function closedMessage(action: "suspend" | "terminate", name: string, simulate = false): string {
  const note = simulate ? ` ${ORANGE}${SIMULATE_NOTE}${RESET}` : "";
  const text =
    action === "suspend"
      ? `Suspension command sent to ${name}`
      : `Termination command sent to ${name}`;
  return `${text}${note}`;
}

async function pickDevice(
  runtime: Runtime,
  title: string,
  listDevices: () => MenuItem[],
): Promise<MenuItem | typeof BACK | typeof CLOSED> {
  let selectedIndex: number | undefined;
  while (true) {
    const items = listDevices();
    const picked = await runtime.pick(title, items, { closeable: true, selected: selectedIndex });
    if (picked === BACK) {
      return BACK;
    }
    if (isCloseRequest(picked)) {
      selectedIndex = Math.max(
        0,
        items.findIndex((item) => item.value === picked.item.value),
      );
      const action = await confirmClose(runtime, picked.item);
      if (action === "back") {
        continue;
      }
      try {
        if (action === "suspend") {
          await runtime.suspendDevice(picked.item);
          runtime.log(closedMessage("suspend", picked.item.name, runtime.simulate));
        } else {
          runtime.terminateDevice(picked.item);
          runtime.log(closedMessage("terminate", picked.item.name, runtime.simulate));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        runtime.error(`Failed to ${action} ${picked.item.name}: ${message}`);
        continue;
      }
      return CLOSED;
    }
    return picked;
  }
}

export async function createAndroidDevice(runtime: Runtime): Promise<void | typeof BACK> {
  while (true) {
    const formFactor = await runtime.pick("Select a form factor", [
      { name: "Mobile Phone", value: "phone" },
      { name: "Wear", value: "wear" },
    ]);
    if (formFactor === BACK || isCloseRequest(formFactor)) {
      return BACK;
    }

    let preferPackage: string | undefined;
    while (true) {
      const image = await pickInstalledSdk(runtime, formFactor.value as FormFactor, preferPackage);
      if (image === BACK) {
        break;
      }
      preferPackage = image.package;

      const profiles = runtime.listDeviceProfiles(image);
      if (profiles.length === 0) {
        runtime.error("No device definitions found. Is avdmanager installed?");
        continue;
      }

      const device = await runtime.pick("Select an emulator", profiles);
      if (device === BACK || isCloseRequest(device)) {
        continue;
      }

      runtime.write(`Creating ${device.avdName || device.name} on ${image.name}...\n`);
      const avdName = await runtime.createAvd(image, device);
      const pid = runtime.startAndroid({ name: avdName, value: avdName });
      runtime.log(startedMessage(`${avdName} (pid ${pid}, detached). Logs: ${EMULATOR_LOG}`, runtime.simulate));
      return;
    }
  }
}

export async function main(runtime: Runtime): Promise<void> {
  while (true) {
    const platform = await runtime.pick("Select a platform", runtime.listPlatforms());
    if (platform === BACK || isCloseRequest(platform)) {
      runtime.log("Cancelled.");
      runtime.exit(0);
      return;
    }

    if (platform.value === "ios" || platform.value === "watchos") {
      const list = () =>
        platform.value === "ios" ? runtime.listIosSimulators() : runtime.listWatchSimulators();
      if (list().length === 0) {
        runtime.error(NO_EMULATORS);
        runtime.exit(1);
        return;
      }
      const device = await pickDevice(runtime, "Select an emulator", list);
      if (device === BACK) {
        continue;
      }
      if (device === CLOSED) {
        return;
      }
      const pid = runtime.startIos(device);
      runtime.log(startedMessage(`${device.name} (pid ${pid}, detached).`, runtime.simulate));
      return;
    }

    const device = await pickDevice(runtime, "Select an emulator", () => runtime.listAndroidAvds());
    if (device === BACK) {
      continue;
    }
    if (device === CLOSED) {
      return;
    }
    if (device.create) {
      const created = await createAndroidDevice(runtime);
      if (created === BACK) {
        continue;
      }
      return;
    }

    const pid = runtime.startAndroid(device);
    runtime.log(startedMessage(`${device.name} (pid ${pid}, detached). Logs: ${EMULATOR_LOG}`, runtime.simulate));
    return;
  }
}
