import type { System } from "../../system/types";
import { EmulatorshError, ErrorCode } from "../errors";
import type { SystemImage } from "../types";
import { listAvailableSystemImages, listInstalledSystemImages } from "./images";

function imageMatches(image: SystemImage, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return false;
  }
  if (image.package.toLowerCase() === q) {
    return true;
  }
  if (image.name.toLowerCase() === q) {
    return true;
  }
  const api = image.api.toLowerCase();
  return q === api || q === `api ${api}` || q === `api_${api}` || q === `android-${api}`;
}

function pickImages(images: SystemImage[], query: string): SystemImage[] {
  return images.filter((image) => imageMatches(image, query));
}

function preferPlaystore(images: SystemImage[]): SystemImage[] {
  const playstore = images.filter((image) => image.package.includes("google_apis_playstore"));
  if (playstore.length === 1 && playstore[0]) {
    return playstore;
  }
  const google = images.filter((image) => /;google_apis;/.test(image.package));
  if (google.length === 1 && google[0]) {
    return google;
  }
  return images;
}

function allInstalled(system: System): SystemImage[] {
  return [...listInstalledSystemImages(system, "phone"), ...listInstalledSystemImages(system, "wear")];
}

function allAvailable(system: System): SystemImage[] {
  return [...listAvailableSystemImages(system, "phone"), ...listAvailableSystemImages(system, "wear")];
}

export function findSystemImage(system: System, query: string): SystemImage {
  const installedHits = pickImages(allInstalled(system), query);
  if (installedHits.length === 1 && installedHits[0]) {
    return installedHits[0];
  }
  if (installedHits.length > 1) {
    const narrowed = preferPlaystore(installedHits);
    if (narrowed.length === 1 && narrowed[0]) {
      return narrowed[0];
    }
    throw new EmulatorshError(
      ErrorCode.DEVICE_AMBIGUOUS,
      `Several system images match "${query}": ${installedHits.map((image) => image.name).join(", ")}.`,
    );
  }

  const availableHits = pickImages(allAvailable(system), query);
  if (availableHits.length === 0) {
    throw new EmulatorshError(ErrorCode.DEVICE_NOT_FOUND, `No Android system image matches "${query}".`);
  }
  const chosen =
    (availableHits.length === 1 ? availableHits[0] : preferPlaystore(availableHits)[0]) ?? availableHits[0];
  if (!chosen) {
    throw new EmulatorshError(ErrorCode.DEVICE_NOT_FOUND, `No Android system image matches "${query}".`);
  }
  return chosen;
}

export function isSystemImageInstalled(system: System, image: SystemImage): boolean {
  return allInstalled(system).some((installed) => installed.package === image.package);
}
