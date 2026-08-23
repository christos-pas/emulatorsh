import { execFileSync } from "node:child_process";
import path from "node:path";

import { androidSerialForAvd } from "./android/avds";
import { avdHome, resolveAdb } from "./android/sdk";
import { runFile } from "../system/exec";
import { rmSync } from "../system/fs";
import type { System } from "../system/types";
import { EmulatorshError, ErrorCode } from "./errors";

export function suspendAndroid(system: System, avdName: string): void {
  // Graceful close. Quick Boot saves a snapshot so the next start is not a cold boot.
  killAndroidConsole(system, avdName);
}

export function terminateAndroid(system: System, avdName: string): void {
  // Drop the current RAM session without saving it, then delete Quick Boot
  // snapshots so the next `emulator -avd` cold-boots. Disk images stay, so
  // installed apps and userdata are kept.
  const killed = killEmulatorProcesses(avdName);
  try {
    killAndroidConsole(system, avdName);
  } catch (error) {
    if (!killed) {
      throw error;
    }
  }
  discardQuickBoot(system, avdName);
}

export function suspendApple(system: System, udid: string): void {
  runFile(system, "xcrun", ["simctl", "shutdown", udid], { stdio: "ignore" });
}

export function emuOutputFailed(output: string): boolean {
  const text = output.trim();
  return /^KO\b/m.test(text) || /unknown command/i.test(text);
}

export function avdSnapshotsDir(avdName: string, home: string): string {
  return path.join(home, `${avdName}.avd`, "snapshots");
}

function requireAdb(system: System): string {
  const adb = resolveAdb(system);
  if (!adb) {
    throw new EmulatorshError(
      ErrorCode.NO_ADB,
      "Could not find adb. Is the Android SDK platform-tools installed?",
    );
  }
  return adb;
}

function requireSerial(system: System, avdName: string): string {
  const serial = androidSerialForAvd(system, avdName);
  if (!serial) {
    throw new EmulatorshError(
      ErrorCode.DEVICE_NOT_FOUND,
      `Could not find a running emulator for ${avdName}.`,
    );
  }
  return serial;
}

function killAndroidConsole(system: System, avdName: string): void {
  const adb = requireAdb(system);
  const serial = requireSerial(system, avdName);
  const output = runFile(system, adb, ["-s", serial, "emu", "kill"], { encoding: "utf8" });
  if (emuOutputFailed(output)) {
    throw new Error(output.trim() || `adb emu kill failed for ${avdName}.`);
  }
}

function discardQuickBoot(system: System, avd: string): void {
  rmSync(system, avdSnapshotsDir(avd, avdHome(system)));
}

function killEmulatorProcesses(avd: string): boolean {
  const pids = emulatorPidsForAvd(avd);
  let killed = false;
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
      killed = true;
    } catch {
      // process already gone
    }
  }
  return killed;
}

function emulatorPidsForAvd(avd: string): number[] {
  try {
    const output = execFileSync("ps", ["-Ao", "pid=,command="], { encoding: "utf8" });
    const pids: number[] = [];
    for (const line of output.split(/\r?\n/)) {
      if (!lineMatchesAvd(line, avd)) {
        continue;
      }
      const pid = Number(line.trim().split(/\s+/)[0]);
      if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
        pids.push(pid);
      }
    }
    return pids;
  } catch {
    return [];
  }
}

export function lineMatchesAvd(line: string, avd: string): boolean {
  const tokens = line.trim().split(/\s+/);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) {
      continue;
    }
    if ((token === "-avd" || token === "--avd") && tokens[i + 1] === avd) {
      return true;
    }
    if (token === `-avd=${avd}` || token === `--avd=${avd}` || token === `@${avd}`) {
      return true;
    }
    if (token.split(/[/\\]/).includes(`${avd}.avd`)) {
      return true;
    }
  }
  return false;
}
