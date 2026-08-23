import { runFile, spawnProcess } from "../system/exec";
import { closeSync, openSync } from "../system/fs";
import { EMULATOR_LOG } from "./constants";
import type { MenuItem } from "./types";
import { resolveAndroidEmulator } from "./android/sdk";

export function startAndroid(device: MenuItem): number {
  const emulatorBin = device.emulatorBin || resolveAndroidEmulator();
  if (!emulatorBin) {
    throw new Error("Could not find the Android emulator binary.");
  }
  const logFd = openSync(EMULATOR_LOG, "a");
  const child = spawnProcess(emulatorBin, ["-avd", device.value], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  closeSync(logFd);
  return child.pid as number;
}

export function startIos(device: MenuItem): number {
  try {
    runFile("xcrun", ["simctl", "boot", device.value], { stdio: "ignore" });
  } catch {
    // Already booted (or boot is in progress).
  }
  const child = spawnProcess("open", ["-a", "Simulator"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return child.pid as number;
}
