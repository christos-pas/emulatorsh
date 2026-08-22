import path from "node:path";

import { CREATE_VALUE } from "../constants.js";
import type { ExistingAvd, ExecOutputError, MenuItem, SystemImage } from "../types.js";
import { runFile } from "../host/exec.js";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "../host/fs.js";
import { nextUniqueName, sanitizeAvdName } from "./format.js";
import { avdHome, resolveAdb, resolveAndroidEmulator, resolveAvdmanager } from "./sdk.js";

export { sanitizeAvdName };

export function androidEmulatorSerials(): { serial: string; name: string }[] {
  const adbBin = resolveAdb();
  if (!adbBin) {
    return [];
  }

  let devicesOutput: string;
  try {
    devicesOutput = runFile(adbBin, ["devices"], { encoding: "utf8" });
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
      const name = runFile(adbBin, ["-s", serial, "emu", "avd", "name"], {
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

export function androidSerialForAvd(avdName: string): string | null {
  return androidEmulatorSerials().find((device) => device.name === avdName)?.serial ?? null;
}

export function runningAndroidAvdNames(): Set<string> {
  return new Set(androidEmulatorSerials().map((device) => device.name));
}

export function createNewDeviceOption(): MenuItem {
  return {
    name: "Create new device",
    value: CREATE_VALUE,
    create: true,
    accent: "purple",
  };
}

export function listAndroidAvds(): MenuItem[] {
  const emulatorBin = resolveAndroidEmulator();
  const avds: MenuItem[] = [];
  if (emulatorBin) {
    try {
      const output = runFile(emulatorBin, ["-list-avds"], {
        encoding: "utf8",
      });
      const running = runningAndroidAvdNames();
      for (const name of output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)) {
        avds.push({
          name,
          value: name,
          emulatorBin,
          running: running.has(name),
        });
      }
    } catch {
      // fall through and still offer create
    }
  }
  avds.push(createNewDeviceOption());
  return avds;
}

export function readIni(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match?.[1] && match[2] !== undefined) {
      values[match[1].trim()] = match[2].trim();
    }
  }
  return values;
}

export function existingAvds(): ExistingAvd[] {
  const dir = avdHome();
  if (!existsSync(dir)) {
    return [];
  }
  const avds: ExistingAvd[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".ini")) {
      continue;
    }
    const ini = readIni(path.join(dir, entry));
    const avdPath = ini.path || path.join(dir, entry.replace(/\.ini$/, ".avd"));
    const config = readIni(path.join(avdPath, "config.ini"));
    avds.push({
      name: entry.replace(/\.ini$/, ""),
      deviceName: config["hw.device.name"] || "",
      sysdir: (config["image.sysdir.1"] || "").replace(/\/$/, ""),
    });
  }
  return avds;
}

export function uniqueAvdName(base: string, takenNames?: Iterable<string>): string {
  return nextUniqueName(
    base,
    takenNames ?? existingAvds().map((avd) => avd.name),
  );
}

export function enableHardwareKeyboard(avdName: string): void {
  const configPath = path.join(avdHome(), `${avdName}.avd`, "config.ini");
  if (!existsSync(configPath)) {
    throw new Error(`Created AVD is missing config.ini at ${configPath}`);
  }
  let contents = readFileSync(configPath, "utf8");
  if (/^hw\.keyboard=/m.test(contents)) {
    contents = contents.replace(/^hw\.keyboard=.*$/m, "hw.keyboard=yes");
  } else {
    contents += `${contents.endsWith("\n") ? "" : "\n"}hw.keyboard=yes\n`;
  }
  writeFileSync(configPath, contents);
}

export function createAvd(image: SystemImage, device: MenuItem): string {
  const avdmanager = resolveAvdmanager();
  if (!avdmanager) {
    throw new Error(
      "Could not find avdmanager. Install Android SDK Command-line Tools.",
    );
  }
  const avdName = uniqueAvdName(sanitizeAvdName(device.name, image.api));
  try {
    runFile(
      avdmanager,
      [
        "create",
        "avd",
        "--name",
        avdName,
        "--package",
        image.package,
        "--device",
        device.value,
      ],
      { encoding: "utf8", input: "no\n", stdio: ["pipe", "pipe", "pipe"] },
    );
  } catch (error) {
    const execError = error as ExecOutputError;
    const details = [execError.stderr, execError.stdout, execError.message]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(`Failed to create AVD ${avdName}.\n${details}`);
  }
  enableHardwareKeyboard(avdName);
  return avdName;
}
