import { execFileSync } from "node:child_process";
import path from "node:path";

import { androidSerialForAvd } from "./android/avds";
import { avdHome, resolveAdb } from "./android/sdk";
import { isAppleDeviceId } from "./apple/id";
import { runFile } from "../system/exec";
import { rmSync } from "../system/fs";
import type { MenuItem } from "./types";

export function suspendDevice(device: MenuItem): void {
  if (isAppleDeviceId(device.value)) {
    shutdownApple(device);
    return;
  }
  // Graceful close. Quick Boot saves a snapshot so the next start is not a cold boot.
  killAndroidConsole(device);
}

export function terminateDevice(device: MenuItem): void {
  if (isAppleDeviceId(device.value)) {
    shutdownApple(device);
    return;
  }
  // Drop the current RAM session without saving it, then delete Quick Boot
  // snapshots so the next `emulator -avd` cold-boots. Disk images stay, so
  // installed apps and userdata are kept.
  const killed = killEmulatorProcesses(device.value);
  try {
    killAndroidConsole(device);
  } catch (error) {
    if (!killed) {
      throw error;
    }
  }
  discardQuickBoot(device.value);
}

export function emuOutputFailed(output: string): boolean {
  const text = output.trim();
  return /^KO\b/m.test(text) || /unknown command/i.test(text);
}

export function avdSnapshotsDir(avdName: string): string {
  return path.join(avdHome(), `${avdName}.avd`, "snapshots");
}

function requireAdb(): string {
  const adb = resolveAdb();
  if (!adb) {
    throw new Error("Could not find adb. Is the Android SDK platform-tools installed?");
  }
  return adb;
}

function requireSerial(device: MenuItem): string {
  const serial = androidSerialForAvd(device.value);
  if (!serial) {
    throw new Error(`Could not find a running emulator for ${device.name}.`);
  }
  return serial;
}

function killAndroidConsole(device: MenuItem): void {
  const adb = requireAdb();
  const serial = requireSerial(device);
  const output = runFile(adb, ["-s", serial, "emu", "kill"], { encoding: "utf8" });
  if (emuOutputFailed(output)) {
    throw new Error(output.trim() || `adb emu kill failed for ${device.name}.`);
  }
}

function shutdownApple(device: MenuItem): void {
  runFile("xcrun", ["simctl", "shutdown", device.value], { stdio: "ignore" });
}

function discardQuickBoot(avd: string): void {
  rmSync(avdSnapshotsDir(avd));
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
