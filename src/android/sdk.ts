import os from "node:os";
import path from "node:path";

import { isSimulate } from "../demo/mode.js";
import {
  MOCK_ADB,
  MOCK_AVD_HOME,
  MOCK_AVDMANAGER,
  MOCK_EMULATOR,
  MOCK_SDK_ROOT,
  MOCK_SDKMANAGER,
} from "../demo/paths.js";
import { runFile } from "../host/exec.js";
import { existsSync, readdirSync } from "../host/fs.js";

export function homeDir(): string {
  return os.homedir();
}

export function sdkRootCandidates(): string[] {
  return [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
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
  if (isSimulate()) {
    return MOCK_SDK_ROOT;
  }
  for (const root of sdkRootCandidates()) {
    if (existsSync(root)) {
      return root;
    }
  }
  const emulatorBin = resolveAndroidEmulator();
  if (emulatorBin && emulatorBin !== "emulator") {
    return path.dirname(path.dirname(emulatorBin));
  }
  return null;
}

export function resolveAndroidEmulator(): string | null {
  if (isSimulate()) {
    return MOCK_EMULATOR;
  }
  return firstExisting(emulatorCandidates());
}

export function resolveAdb(): string | null {
  if (isSimulate()) {
    return MOCK_ADB;
  }
  return firstExisting([
    ...sdkRootCandidates().map((root) => path.join(root, "platform-tools", "adb")),
    "adb",
  ]);
}

export function resolveAvdmanager(): string | null {
  if (isSimulate()) {
    return MOCK_AVDMANAGER;
  }
  const sdkRoot = resolveSdkRoot();
  const candidates: string[] = [];
  if (sdkRoot) {
    const cmdline = path.join(sdkRoot, "cmdline-tools");
    candidates.push(path.join(cmdline, "latest", "bin", "avdmanager"));
    if (existsSync(cmdline)) {
      for (const entry of readdirSync(cmdline)) {
        candidates.push(path.join(cmdline, entry, "bin", "avdmanager"));
      }
    }
    candidates.push(path.join(sdkRoot, "tools", "bin", "avdmanager"));
  }
  candidates.push("avdmanager");
  return firstExisting(candidates);
}

export function resolveSdkmanager(): string | null {
  if (isSimulate()) {
    return MOCK_SDKMANAGER;
  }
  const sdkRoot = resolveSdkRoot();
  const candidates: string[] = [];
  if (sdkRoot) {
    const cmdline = path.join(sdkRoot, "cmdline-tools");
    candidates.push(path.join(cmdline, "latest", "bin", "sdkmanager"));
    if (existsSync(cmdline)) {
      for (const entry of readdirSync(cmdline)) {
        candidates.push(path.join(cmdline, entry, "bin", "sdkmanager"));
      }
    }
    candidates.push(path.join(sdkRoot, "tools", "bin", "sdkmanager"));
  }
  candidates.push("sdkmanager");
  return firstExisting(candidates);
}

export function hostAbi(): "arm64-v8a" | "x86_64" {
  return os.arch() === "arm64" ? "arm64-v8a" : "x86_64";
}

export function apiSortKey(api: string): number {
  const numeric = parseFloat(String(api).replace("-ext", "."));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function avdHome(): string {
  if (isSimulate()) {
    return MOCK_AVD_HOME;
  }
  return process.env.ANDROID_AVD_HOME || path.join(homeDir(), ".android", "avd");
}
