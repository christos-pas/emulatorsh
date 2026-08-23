import path from "node:path";

import type { AndroidDevice, DeviceProfile, ExistingAvd, ExecOutputError, SystemImage } from "../types";
import { runFile } from "../../system/exec";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "../../system/fs";
import type { System } from "../../system/types";
import { nextUniqueName, sanitizeAvdName } from "./format";
import { avdHome, resolveAdb, resolveAndroidEmulator, resolveAvdmanager } from "./sdk";
import { EmulatorshError, ErrorCode } from "../errors";

export { sanitizeAvdName };

export function androidEmulatorSerials(system: System): { serial: string; name: string }[] {
  const adbBin = resolveAdb(system);
  if (!adbBin) {
    return [];
  }

  let devicesOutput: string;
  try {
    devicesOutput = runFile(system, adbBin, ["devices"], { encoding: "utf8" });
  } catch {
    return [];
  }

  const serials = devicesOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("emulator-") && /\s+device$/.test(line))
    .map((line) => line.split(/\s+/)[0])
    .filter((serial): serial is string => Boolean(serial));

  const devices: { serial: string; name: string }[] = [];
  for (const serial of serials) {
    try {
      const name = runFile(system, adbBin, ["-s", serial, "emu", "avd", "name"], {
        encoding: "utf8",
      })
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line && line !== "OK");
      if (name) {
        devices.push({ serial, name });
      }
    } catch {
      // emulator may have disconnected mid-query
    }
  }
  return devices;
}

export function androidSerialForAvd(system: System, avdName: string): string | null {
  return androidEmulatorSerials(system).find((device) => device.name === avdName)?.serial ?? null;
}

export function runningAndroidAvdNames(system: System): Set<string> {
  return new Set(androidEmulatorSerials(system).map((device) => device.name));
}

export function listAndroidAvds(system: System): AndroidDevice[] {
  const emulatorBin = resolveAndroidEmulator(system);
  if (!emulatorBin) {
    return [];
  }
  try {
    const output = runFile(system, emulatorBin, ["-list-avds"], {
      encoding: "utf8",
    });
    const running = runningAndroidAvdNames(system);
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({
        name,
        running: running.has(name),
      }));
  } catch {
    return [];
  }
}

export function readIni(system: System, filePath: string): Record<string, string> {
  if (!existsSync(system, filePath)) {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of readFileSync(system, filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match?.[1] && match[2] !== undefined) {
      values[match[1].trim()] = match[2].trim();
    }
  }
  return values;
}

export function existingAvds(system: System): ExistingAvd[] {
  const dir = avdHome(system);
  if (!existsSync(system, dir)) {
    return [];
  }
  const avds: ExistingAvd[] = [];
  for (const entry of readdirSync(system, dir)) {
    if (!entry.endsWith(".ini")) {
      continue;
    }
    const ini = readIni(system, path.join(dir, entry));
    const avdPath = ini.path || path.join(dir, entry.replace(/\.ini$/, ".avd"));
    const config = readIni(system, path.join(avdPath, "config.ini"));
    avds.push({
      name: entry.replace(/\.ini$/, ""),
      deviceName: config["hw.device.name"] || "",
      sysdir: (config["image.sysdir.1"] || "").replace(/\/$/, ""),
    });
  }
  return avds;
}

export function uniqueAvdName(system: System, base: string, takenNames?: Iterable<string>): string {
  return nextUniqueName(
    base,
    takenNames ?? existingAvds(system).map((avd) => avd.name),
  );
}

export function enableHardwareKeyboard(system: System, avdName: string): void {
  const configPath = path.join(avdHome(system), `${avdName}.avd`, "config.ini");
  if (!existsSync(system, configPath)) {
    throw new Error(`Created AVD is missing config.ini at ${configPath}`);
  }
  let contents = readFileSync(system, configPath, "utf8");
  if (/^hw\.keyboard=/m.test(contents)) {
    contents = contents.replace(/^hw\.keyboard=.*$/m, "hw.keyboard=yes");
  } else {
    contents += `${contents.endsWith("\n") ? "" : "\n"}hw.keyboard=yes\n`;
  }
  writeFileSync(system, configPath, contents);
}

export function createAvd(system: System, image: SystemImage, profile: DeviceProfile): string {
  const avdmanager = resolveAvdmanager(system);
  if (!avdmanager) {
    throw new EmulatorshError(
      ErrorCode.NO_AVDMANAGER,
      "Could not find avdmanager. Install Android SDK Command-line Tools.",
    );
  }
  const avdName = uniqueAvdName(system, sanitizeAvdName(profile.name, image.api));
  try {
    runFile(
      system,
      avdmanager,
      [
        "create",
        "avd",
        "--name",
        avdName,
        "--package",
        image.package,
        "--device",
        profile.id,
      ],
      { encoding: "utf8", input: "no\n", stdio: ["pipe", "pipe", "pipe"] },
    );
  } catch (error) {
    const execError = error as ExecOutputError;
    const details = [execError.stderr, execError.stdout, execError.message]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new EmulatorshError(
      ErrorCode.CREATE_FAILED,
      `Failed to create AVD ${avdName}.\n${details}`,
    );
  }
  enableHardwareKeyboard(system, avdName);
  return avdName;
}
