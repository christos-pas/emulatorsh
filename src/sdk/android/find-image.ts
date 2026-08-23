import type { System } from "../../system/types";
import { EmulatorshError, ErrorCode } from "../errors";
import type { FormFactor, SystemImage } from "../types";
import { listAvailableSystemImages, listInstalledSystemImages } from "./images";
import { hostAbi } from "./sdk";

export interface FindImageOptions {
  formFactor?: FormFactor;
  accept?: (image: SystemImage) => boolean;
}

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

function narrowImages(images: SystemImage[]): SystemImage[] {
  const exactPlaystore = images.filter((image) => /;google_apis_playstore;/.test(image.package));
  const playstore = images.filter((image) => /playstore/i.test(image.package));
  const google = images.filter((image) => /;google_apis;/.test(image.package));
  const preferred =
    exactPlaystore.length > 0
      ? exactPlaystore
      : playstore.length > 0
        ? playstore
        : google.length > 0
          ? google
          : images;
  const abi = hostAbi();
  const forHost = preferred.filter((image) => image.package.endsWith(`;${abi}`));
  return forHost.length > 0 ? forHost : preferred;
}

function requireOneImage(images: SystemImage[], query: string): SystemImage {
  if (images.length === 1 && images[0]) {
    return images[0];
  }
  const narrowed = narrowImages(images);
  if (narrowed.length === 1 && narrowed[0]) {
    return narrowed[0];
  }
  throw new EmulatorshError(
    ErrorCode.DEVICE_AMBIGUOUS,
    `Several system images match "${query}": ${images.map((image) => image.name).join(", ")}.`,
  );
}

function allInstalled(system: System): SystemImage[] {
  return [...listInstalledSystemImages(system, "phone"), ...listInstalledSystemImages(system, "wear")];
}

export function findSystemImage(
  system: System,
  query: string,
  options: FindImageOptions = {},
): SystemImage {
  const accept = options.accept ?? (() => true);
  const formFactors: FormFactor[] = options.formFactor ? [options.formFactor] : ["phone", "wear"];

  let matchedQuery = false;
  for (const formFactor of formFactors) {
    const installed = pickImages(listInstalledSystemImages(system, formFactor), query);
    const available = pickImages(listAvailableSystemImages(system, formFactor), query);
    if (installed.length + available.length > 0) {
      matchedQuery = true;
    }
    const installedOk = installed.filter(accept);
    if (installedOk.length > 0) {
      return requireOneImage(installedOk, query);
    }
    const availableOk = available.filter(accept);
    if (availableOk.length > 0) {
      return requireOneImage(availableOk, query);
    }
  }

  if (matchedQuery) {
    throw new EmulatorshError(
      ErrorCode.DEVICE_NOT_FOUND,
      `No Android system image matching "${query}" is compatible with this device.`,
    );
  }
  throw new EmulatorshError(ErrorCode.DEVICE_NOT_FOUND, `No Android system image matches "${query}".`);
}

export function isSystemImageInstalled(system: System, image: SystemImage): boolean {
  return allInstalled(system).some((installed) => installed.package === image.package);
}
