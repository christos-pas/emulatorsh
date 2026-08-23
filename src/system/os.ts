import type { HostOs } from "./types";

export function hostOsFromPlatform(platform = process.platform): HostOs {
  if (platform === "darwin") {
    return "macos";
  }
  if (platform === "win32") {
    return "windows";
  }
  return "linux";
}
