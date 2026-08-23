import { runFile, spawnProcess } from "../system/exec";
import { closeSync, openSync } from "../system/fs";
import type { System } from "../system/types";
import { EMULATOR_LOG } from "./constants";
import { resolveAndroidEmulator } from "./android/sdk";
import { EmulatorshError, ErrorCode } from "./errors";

export function startAndroid(system: System, avdName: string): number {
  const emulatorBin = resolveAndroidEmulator(system);
  if (!emulatorBin) {
    throw new EmulatorshError(ErrorCode.NO_EMULATOR, "Could not find the Android emulator binary.");
  }
  const logFd = openSync(system, EMULATOR_LOG, "a");
  const child = spawnProcess(system, emulatorBin, ["-avd", avdName], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  closeSync(system, logFd);
  return child.pid as number;
}

export function startIos(system: System, udid: string): number {
  try {
    runFile(system, "xcrun", ["simctl", "boot", udid], { stdio: "ignore" });
  } catch {
    // Already booted (or boot is in progress).
  }
  const child = spawnProcess(system, "open", ["-a", "Simulator"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return child.pid as number;
}
