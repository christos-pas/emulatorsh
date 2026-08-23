import type { System } from "../../system/types";
import { EmulatorshError, ErrorCode } from "../errors";
import type { DeviceDefinition, DeviceProfile, SystemImage } from "../types";
import { createAvd } from "./avds";
import { findSystemImage, isSystemImageInstalled } from "./find-image";
import { installSystemImage } from "./images";
import {
  findDeviceDefinition,
  formFactorOfProfile,
  listDeviceProfiles,
  profileAcceptsImage,
  profileQueryMatches,
} from "./profiles";

export interface CreateOptions {
  installDeps?: boolean;
}

function findProfile(profiles: DeviceProfile[], query: string): DeviceProfile | undefined {
  const matches = profiles.filter((profile) => profileQueryMatches(profile, query));
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
  profile: Pick<DeviceDefinition, "id" | "name"> & { tag?: string },
): Promise<SystemImage> {
  const image = findSystemImage(system, sdkQuery, {
    formFactor: formFactorOfProfile(profile),
    accept: (candidate) => profileAcceptsImage(system, profile, candidate),
  });
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

function requireCompatible(
  system: System,
  profile: Pick<DeviceDefinition, "id" | "name"> & { tag?: string },
  image: SystemImage,
): void {
  if (profileAcceptsImage(system, profile, image)) {
    return;
  }
  throw new EmulatorshError(
    ErrorCode.PROFILE_NOT_FOUND,
    `${profile.name} (${profile.id}) is not compatible with ${image.name}.`,
  );
}

export async function createFromRefs(
  system: System,
  imageRef: SystemImage | string,
  profileRef: DeviceProfile | string,
  options: CreateOptions = {},
): Promise<{ name: string; running: false }> {
  const definition =
    typeof profileRef === "string"
      ? findDeviceDefinition(system, profileRef)
      : { id: profileRef.id, name: profileRef.name, tag: "" };
  const image =
    typeof imageRef === "string"
      ? await resolveImage(system, imageRef, Boolean(options.installDeps), definition)
      : imageRef;
  requireCompatible(system, definition, image);
  const profile = typeof profileRef === "string" ? requireProfile(system, image, profileRef) : profileRef;
  return { name: createAvd(system, image, profile), running: false };
}
