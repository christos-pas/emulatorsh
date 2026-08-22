import { WEAR_POPULAR_IDS } from "../constants.js";
import { isSimulate, simulateProfileSdks } from "../demo/mode.js";
import type { DeviceDefinition, FormFactor, MenuItem, SystemImage } from "../types.js";
import { runFile } from "../host/exec.js";
import { existingAvds } from "./avds.js";
import { loadDeviceSoftware, specSupportedByDevice } from "./device-xml.js";
import { sanitizeAvdName } from "./format.js";
import { resolveAvdmanager } from "./sdk.js";
import { profileSupportsImage, specFromImage, sysdirMatchesImage } from "./specs.js";

export function parseDeviceDefinitions(output: string): DeviceDefinition[] {
  const devices: DeviceDefinition[] = [];
  for (const block of output.split(/^-{3,}$/m)) {
    const idMatch = block.match(/id:\s*\d+\s+or\s+"([^"]+)"/);
    const nameMatch = block.match(/Name:\s*(.+)/);
    if (!idMatch?.[1] || !nameMatch?.[1]) {
      continue;
    }
    const tagMatch = block.match(/Tag\s*:\s*(.+)/);
    const id = idMatch[1].trim();
    const name = nameMatch[1].trim();
    const tag = tagMatch?.[1] ? tagMatch[1].trim() : "";
    devices.push({ id, name, tag });
  }
  return devices;
}

export function isAllowedPhoneProfile(device: DeviceDefinition): boolean {
  const id = device.id.toLowerCase();
  const name = device.name.toLowerCase();
  if (/(desktop|automotive|wear|television|glasses|\bxr\b)/.test(`${id} ${name} ${device.tag}`)) {
    return false;
  }
  if (id.startsWith("pixel") || name.startsWith("pixel")) {
    return true;
  }
  if (id.startsWith("galaxy") || name.startsWith("galaxy")) {
    return true;
  }
  if (id.startsWith("nexus") || name.startsWith("nexus")) {
    return true;
  }
  if (
    id === "medium_phone" ||
    id === "medium_tablet" ||
    name === "medium phone" ||
    name === "medium tablet"
  ) {
    return true;
  }
  if (
    id === "small_phone" ||
    id === "small_tablet" ||
    name === "small phone" ||
    name === "small tablet"
  ) {
    return true;
  }
  return id === "resizable" || name.startsWith("resizable");
}

export function isAllowedWearProfile(device: DeviceDefinition): boolean {
  return WEAR_POPULAR_IDS.has(device.id);
}

export function listDeviceProfiles(image: SystemImage, formFactor: FormFactor): MenuItem[] {
  const avdmanager = resolveAvdmanager();
  if (!avdmanager) {
    return [];
  }
  let output: string;
  try {
    output = runFile(avdmanager, ["list", "device"], { encoding: "utf8" });
  } catch {
    return [];
  }

  const installed = existingAvds();
  const allow = formFactor === "wear" ? isAllowedWearProfile : isAllowedPhoneProfile;
  const software = isSimulate() ? undefined : loadDeviceSoftware();
  const demoById = simulateProfileSdks();
  const selected = specFromImage(image);

  return parseDeviceDefinitions(output)
    .filter(allow)
    .filter((device) => {
      if (demoById) {
        return profileSupportsImage(demoById.get(device.id), image);
      }
      if (!selected || !software) {
        return true;
      }
      const meta = software.get(device.id);
      return !meta || specSupportedByDevice(selected.api, selected.tag, meta);
    })
    .map((device) => {
      const installedCount = installed.filter(
        (avd) => avd.deviceName === device.id && sysdirMatchesImage(avd.sysdir, image),
      ).length;
      return {
        name: device.name,
        value: device.id,
        avdName: sanitizeAvdName(device.name, image.api),
        installedCount,
        supportedSdks: demoById?.get(device.id),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
