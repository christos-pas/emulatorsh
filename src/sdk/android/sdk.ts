import os from "node:os";
import path from "node:path";

import { getSystem } from "../../system/context";
import { runFile } from "../../system/exec";
import { existsSync } from "../../system/fs";

export function homeDir(): string {
  return getSystem().paths.homeDir();
}

export function sdkRootCandidates(): string[] {
  const system = getSystem();
  return [
    system.env.get("ANDROID_SDK_ROOT"),
    system.env.get("ANDROID_HOME"),
    path.join(homeDir(), "Library/Android/sdk"),
    path.join(homeDir(), "Android/Sdk"),
  ].filter((candidate): candidate is string => Boolean(candidate));
}

export function emulatorCandidates(): string[] {
  return [
    ...sdkRootCandidates().map((root) => path.join(root, "emulator", "emulator")),
    "emulator",
  ];
}

export function firstExisting(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) || candidate.startsWith(".")) {
      if (existsSync(candidate)) {
        return candidate;
      }
      continue;
    }
    try {
      runFile(candidate, ["-help"], { stdio: "ignore" });
      return candidate;
    } catch {
      // not on PATH
    }
  }
  return null;
}

export function resolveSdkRoot(): string | null {
  return getSystem().paths.sdkRoot();
}

export function resolveAndroidEmulator(): string | null {
  return getSystem().paths.emulator();
}

export function resolveAdb(): string | null {
  return getSystem().paths.adb();
}

export function resolveAvdmanager(): string | null {
  return getSystem().paths.avdmanager();
}

export function resolveSdkmanager(): string | null {
  return getSystem().paths.sdkmanager();
}

export function hostAbi(): "arm64-v8a" | "x86_64" {
  return os.arch() === "arm64" ? "arm64-v8a" : "x86_64";
}

export function apiSortKey(api: string): number {
  const numeric = parseFloat(String(api).replace("-ext", "."));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function avdHome(): string {
  return getSystem().paths.avdHome();
}
