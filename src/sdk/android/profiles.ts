import { WEAR_POPULAR_IDS } from "../constants";
import { EmulatorshError, ErrorCode } from "../errors";
import type { DeviceDefinition, DeviceProfile, FormFactor, SystemImage } from "../types";
import { runFile } from "../../system/exec";
import type { System } from "../../system/types";
import { existingAvds } from "./avds";
import { loadDeviceSoftware, specSupportedByDevice } from "./device-xml";
import { findSystemImage } from "./find-image";
import { sanitizeAvdName } from "./format";
import { formFactorOf } from "./images";
import { resolveAvdmanager } from "./sdk";
import { specsEqual, specFromImage, sysdirMatchesImage } from "./specs";

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

export function formFactorOfProfile(
  profile: Pick<DeviceDefinition, "id" | "name"> & { tag?: string },
): FormFactor | undefined {
  const device = { id: profile.id, name: profile.name, tag: profile.tag ?? "" };
  if (isAllowedWearProfile(device)) {
    return "wear";
  }
  if (isAllowedPhoneProfile(device)) {
    return "phone";
  }
  return undefined;
}

export function profileQueryMatches(
  profile: Pick<DeviceDefinition, "id" | "name">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!q) {
    return false;
  }
  return profile.id.toLowerCase().replace(/[\s-]+/g, "_") === q
    || profile.name.toLowerCase().replace(/[\s-]+/g, "_") === q;
}

export function profileAcceptsImage(
  system: System,
  profile: Pick<DeviceDefinition, "id" | "name"> & { tag?: string },
  image: SystemImage,
): boolean {
  const formFactor = formFactorOfProfile(profile);
  if (formFactor && formFactor !== formFactorOf(image)) {
    return false;
  }
  if (system.profileSdks) {
    const listed = system.profileSdks.get(profile.id);
    if (listed === undefined) {
      return true;
    }
    const spec = specFromImage(image);
    return Boolean(spec && listed.some((item) => specsEqual(item, spec)));
  }
  if (system.kind === "sandbox") {
    return true;
  }
  const spec = specFromImage(image);
  const software = loadDeviceSoftware(system);
  if (!spec || software.size === 0) {
    return true;
  }
  const meta = software.get(profile.id);
  return !meta || specSupportedByDevice(spec.api, spec.tag, meta);
}

function listDeviceDefinitions(system: System): DeviceDefinition[] {
  const avdmanager = resolveAvdmanager(system);
  if (!avdmanager) {
    return [];
  }
  try {
    return parseDeviceDefinitions(runFile(system, avdmanager, ["list", "device"], { encoding: "utf8" }));
  } catch {
    return [];
  }
}

export function findDeviceDefinition(system: System, query: string): DeviceDefinition {
  const matches = listDeviceDefinitions(system)
    .filter((device) => isAllowedPhoneProfile(device) || isAllowedWearProfile(device))
    .filter((device) => profileQueryMatches(device, query));
  if (matches.length > 1) {
    const names = matches.map((device) => `${device.name} (${device.id})`).join(", ");
    throw new EmulatorshError(
      ErrorCode.DEVICE_AMBIGUOUS,
      `Several device profiles match "${query}": ${names}.`,
    );
  }
  const match = matches[0];
  if (!match) {
    throw new EmulatorshError(ErrorCode.PROFILE_NOT_FOUND, `No device profile matches "${query}".`);
  }
  return match;
}

export function listDeviceProfiles(system: System, image: SystemImage | string): DeviceProfile[] {
  const resolved = typeof image === "string" ? findSystemImage(system, image) : image;
  const installed = existingAvds(system);
  const allow = formFactorOf(resolved) === "wear" ? isAllowedWearProfile : isAllowedPhoneProfile;

  return listDeviceDefinitions(system)
    .filter(allow)
    .filter((device) => profileAcceptsImage(system, device, resolved))
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
