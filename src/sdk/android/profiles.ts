import { WEAR_POPULAR_IDS } from "../constants";
import type { DeviceDefinition, DeviceProfile, SystemImage } from "../types";
import { runFile } from "../../system/exec";
import type { System } from "../../system/types";
import { existingAvds } from "./avds";
import { loadDeviceSoftware, specSupportedByDevice } from "./device-xml";
import { findSystemImage } from "./find-image";
import { sanitizeAvdName } from "./format";
import { formFactorOf } from "./images";
import { resolveAvdmanager } from "./sdk";
import { profileSupportsImage, specFromImage, sysdirMatchesImage } from "./specs";

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

export function listDeviceProfiles(system: System, image: SystemImage | string): DeviceProfile[] {
  const resolved = typeof image === "string" ? findSystemImage(system, image) : image;
  const avdmanager = resolveAvdmanager(system);
  if (!avdmanager) {
    return [];
  }
  let output: string;
  try {
    output = runFile(system, avdmanager, ["list", "device"], { encoding: "utf8" });
  } catch {
    return [];
  }

  const installed = existingAvds(system);
  const allow = formFactorOf(resolved) === "wear" ? isAllowedWearProfile : isAllowedPhoneProfile;
  const software = system.kind === "sandbox" ? undefined : loadDeviceSoftware(system);
  const demoById = system.profileSdks;
  const selected = specFromImage(resolved);

  return parseDeviceDefinitions(output)
    .filter(allow)
    .filter((device) => {
      if (demoById) {
        return profileSupportsImage(demoById.get(device.id), resolved);
      }
      if (!selected || !software) {
        return true;
      }
      const meta = software.get(device.id);
      return !meta || specSupportedByDevice(selected.api, selected.tag, meta);
    })
    .map((device) => {
      const installedCount = installed.filter(
        (avd) => avd.deviceName === device.id && sysdirMatchesImage(avd.sysdir, resolved),
      ).length;
      return {
        id: device.id,
        name: device.name,
        avdName: sanitizeAvdName(device.name, resolved.api),
        installedCount,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
