import type { System } from "../../system/types";
import { EmulatorshError, ErrorCode } from "../errors";
import type { DeviceProfile, SystemImage } from "../types";
import { createAvd } from "./avds";
import { findSystemImage, isSystemImageInstalled } from "./find-image";
import { installSystemImage } from "./images";
import { listDeviceProfiles } from "./profiles";

export interface CreateOptions {
  installDeps?: boolean;
}

function profileMatches(profile: DeviceProfile, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!q) {
    return false;
  }
  return profile.id.toLowerCase() === q || profile.name.toLowerCase().replace(/[\s-]+/g, "_") === q;
}

function findProfile(profiles: DeviceProfile[], query: string): DeviceProfile | undefined {
  const matches = profiles.filter((profile) => profileMatches(profile, query));
  if (matches.length > 1) {
    const names = matches.map((profile) => `${profile.name} (${profile.id})`).join(", ");
    throw new EmulatorshError(
      ErrorCode.DEVICE_AMBIGUOUS,
      `Several device profiles match "${query}": ${names}.`,
    );
  }
  return matches[0];
}

async function resolveImage(
  system: System,
  sdkQuery: string,
  installDeps: boolean,
): Promise<SystemImage> {
  const image = findSystemImage(system, sdkQuery);
  if (isSystemImageInstalled(system, image)) {
    return image;
  }
  if (!installDeps) {
    throw new EmulatorshError(
      ErrorCode.SDK_NOT_INSTALLED,
      `${image.name} is not installed. Pass { installDeps: true } to download it.`,
    );
  }
  await installSystemImage(system, image.package);
  return findSystemImage(system, image.package);
}

function requireProfile(system: System, image: SystemImage, profileQuery: string): DeviceProfile {
  const profile = findProfile(listDeviceProfiles(system, image), profileQuery);
  if (!profile) {
    throw new EmulatorshError(
      ErrorCode.PROFILE_NOT_FOUND,
      `No device profile matches "${profileQuery}" for ${image.name}.`,
    );
  }
  return profile;
}

export async function createFromRefs(
  system: System,
  imageRef: SystemImage | string,
  profileRef: DeviceProfile | string,
  options: CreateOptions = {},
): Promise<{ name: string; running: false }> {
  const image =
    typeof imageRef === "string"
      ? await resolveImage(system, imageRef, Boolean(options.installDeps))
      : imageRef;
  const profile = typeof profileRef === "string" ? requireProfile(system, image, profileRef) : profileRef;
  return { name: createAvd(system, image, profile), running: false };
}
