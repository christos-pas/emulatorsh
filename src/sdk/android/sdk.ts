import os from "node:os";
import path from "node:path";

import { runFile } from "../../system/exec";
import { existsSync } from "../../system/fs";
import type { System } from "../../system/types";

export function homeDir(system: System): string {
  return system.paths.homeDir();
}

export function sdkRootCandidates(system: System): string[] {
  return [
    system.env.get("ANDROID_SDK_ROOT"),
    system.env.get("ANDROID_HOME"),
    path.join(homeDir(system), "Library/Android/sdk"),
    path.join(homeDir(system), "Android/Sdk"),
  ].filter((candidate): candidate is string => Boolean(candidate));
}

export function emulatorCandidates(system: System): string[] {
  return [
    ...sdkRootCandidates(system).map((root) => path.join(root, "emulator", "emulator")),
    "emulator",
  ];
}

export function firstExisting(system: System, candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) || candidate.startsWith(".")) {
      if (existsSync(system, candidate)) {
        return candidate;
      }
      continue;
    }
    try {
      runFile(system, candidate, ["-help"], { stdio: "ignore" });
      return candidate;
    } catch {
      // not on PATH
    }
  }
  return null;
}

export function resolveSdkRoot(system: System): string | null {
  return system.paths.sdkRoot();
}

export function resolveAndroidEmulator(system: System): string | null {
  return system.paths.emulator();
}

export function resolveAdb(system: System): string | null {
  return system.paths.adb();
}

export function resolveAvdmanager(system: System): string | null {
  return system.paths.avdmanager();
}

export function resolveSdkmanager(system: System): string | null {
  return system.paths.sdkmanager();
}

export function hostAbi(): "arm64-v8a" | "x86_64" {
  return os.arch() === "arm64" ? "arm64-v8a" : "x86_64";
}

export function apiSortKey(api: string): number {
  const numeric = parseFloat(String(api).replace("-ext", "."));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function avdHome(system: System): string {
  return system.paths.avdHome();
}
