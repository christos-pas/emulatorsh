import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";

import { EMULATOR_LOG } from "../sdk/constants";
import { appleDeviceLabel, appleRuntimeFromKey } from "../sdk/apple/runtime";
import type { ExecOutputError } from "../sdk/types";
import { parseAvdApi } from "../sdk/android/format";
import { abiFromSysdir, isWearSpec, specFromSysdir, specToPackage, specToSysdir } from "../sdk/android/specs";
import type { HostOs } from "../system/types";
import {
  DEMO,
  allDemoImageSpecs,
  demoProfiles,
  seedInstalledPackages,
} from "./data";
import { DEMO_PIDS, DEMO_PLATFORM } from "./constants";
import {
  MOCK_ADB,
  MOCK_AVD_HOME,
  MOCK_AVDMANAGER,
  MOCK_EMULATOR,
  MOCK_SDK_ROOT,
  MOCK_SDKMANAGER,
} from "./paths";
import type { SandboxStore } from "./store";

export type SandboxDeviceKind = "android" | "ios" | "wear";

export interface SandboxHooks {
  os?: HostOs;
  onDeviceStart?(kind: SandboxDeviceKind, title: string, deviceId: string): void;
  onDeviceStop?(deviceId: string): void;
}

export function parseSystemImagePackage(pkg: string): {
  api: string;
  apiDir: string;
  tag: string;
  abi: string;
  sysdir: string;
} | null {
  const match = pkg.match(/^system-images;(android-[^;]+);([^;]+);([^;]+)$/);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  const apiDir = match[1];
  const tag = match[2];
  const abi = match[3];
  return {
    api: apiDir.slice("android-".length),
    apiDir,
    tag,
    abi,
    sysdir: `system-images/${apiDir}/${tag}/${abi}`,
  };
}

export function createSandboxTools(options: SandboxHooks & { store: SandboxStore }) {
  const hooks = options;
  const store = options.store;
  const fileWrites = new Map<string, string>();

  function sandboxOs(): HostOs {
    return hooks.os ?? "macos";
  }

  function deviceKind(
    name: string,
    meta?: { sysdir?: string; deviceName?: string },
  ): Exclude<SandboxDeviceKind, "ios"> {
    const spec = meta?.sysdir ? specFromSysdir(meta.sysdir) : null;
    if (
      (spec && isWearSpec(spec)) ||
      /wear/i.test(`${name} ${meta?.deviceName ?? ""} ${meta?.sysdir ?? ""}`)
    ) {
      return "wear";
    }
    return "android";
  }

  function hostAbi(): "arm64-v8a" | "x86_64" {
    return os.arch() === "arm64" ? "arm64-v8a" : "x86_64";
  }

  function toolBase(bin: string): string {
    return path.basename(bin);
  }

  function flagValue(args: string[], flag: string): string | undefined {
    const index = args.indexOf(flag);
    if (index === -1) {
      return undefined;
    }
    return args[index + 1];
  }

function installedPackages(): string[] {
  const abi = hostAbi();
  const names = new Set<string>([
    ...seedInstalledPackages(abi),
        ...store.listStoredSdks(DEMO_PLATFORM.android).map((row) => row.name),
  ]);
  for (const device of DEMO.androidAvds) {
    const spec = specFromSysdir(device.sysdir);
    if (spec) {
      names.add(specToPackage(spec, abiFromSysdir(device.sysdir) ?? abi));
    }
  }
  return [...names];
}

function androidDevices(): { name: string; deviceName: string; sysdir: string; running: boolean }[] {
  const stored = store.listStoredDevices(DEMO_PLATFORM.android);
  const byName = new Map(stored.map((row) => [row.name, row]));
  const names = new Set<string>();
  const devices: { name: string; deviceName: string; sysdir: string; running: boolean }[] = [];

  const add = (name: string, deviceName: string, sysdir: string, seedRunning: boolean) => {
    if (names.has(name)) {
      return;
    }
    names.add(name);
    const row = byName.get(name);
    devices.push({
      name,
      deviceName,
      sysdir,
      running: row ? row.IsRunning : seedRunning,
    });
  };

  for (const avd of DEMO.androidAvds) {
    add(avd.name, avd.deviceName, avd.sysdir, avd.running);
  }
  for (const row of stored) {
    add(
      row.name,
      row.deviceName || inferDeviceName(row.name),
      row.sysdir || inferSysdir(row.name),
      row.IsRunning,
    );
  }
  return devices;
}

function inferDeviceName(avdName: string): string {
  const seed = DEMO.androidAvds.find((avd) => avd.name === avdName);
  if (seed) {
    return seed.deviceName;
  }
  for (const profile of demoProfiles()) {
    const slug = profile.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (avdName === slug || avdName.startsWith(`${slug}_API_`)) {
      return profile.value;
    }
  }
  return "";
}

function inferSysdir(avdName: string): string {
  const seed = DEMO.androidAvds.find((avd) => avd.name === avdName);
  if (seed) {
    return seed.sysdir;
  }
  const api =
    parseAvdApi(
      avdName,
      allDemoImageSpecs().map((spec) => spec.api),
    ) ?? avdName.match(/_API_(.+)$/)?.[1];
  if (!api) {
    return "";
  }
  const wear = /wear/i.test(avdName);
  const matches = (wear ? DEMO.wearImages : DEMO.phoneImages).filter((item) => item.api === api);
  const abi = hostAbi();
  const installed = new Set(installedPackages());
  const spec =
    matches.find((item) => installed.has(specToPackage(item, abi))) ?? matches[0];
  if (!spec) {
    return `system-images/android-${api}`;
  }
  return specToSysdir(spec, abi);
}

function runningAndroidNames(): string[] {
  return androidDevices()
    .filter((device) => device.running)
    .map((device) => device.name);
}

function adbSerials(): { serial: string; name: string }[] {
  return runningAndroidNames().map((name, index) => ({
    serial: `emulator-${5554 + index * 2}`,
    name,
  }));
}

function markAndroidStopped(avd: string): void {
  const device = androidDevices().find((item) => item.name === avd);
  store.upsertStoredDevice(
    DEMO_PLATFORM.android,
    avd,
    false,
    device ? { deviceName: device.deviceName, sysdir: device.sysdir } : undefined,
  );
  hooks.onDeviceStop?.(avd);
}

function markAppleStopped(udid: string): void {
  const device =
    DEMO.ios.find((item) => item.value === udid) ?? DEMO.watchos.find((item) => item.value === udid);
  const runtime = device ? appleRuntimeFromKey(device.runtime) : null;
  const display = device ? appleDeviceLabel(device.name, device.runtime) : udid;
  const platform = runtime?.os === "watchos" ? DEMO_PLATFORM.watchos : DEMO_PLATFORM.ios;
  if (display) {
    store.upsertStoredDevice(platform, display, false);
  }
  hooks.onDeviceStop?.(udid);
}

function sdkmanagerListOutput(): string {
  const abi = hostAbi();
  const lines = allDemoImageSpecs().map(
    (spec) => `system-images;android-${spec.api};${spec.tag};${abi}`,
  );
  return `Installed packages:\n\nAvailable Packages:\n${lines.join("\n")}\n`;
}

function avdmanagerListOutput(): string {
  return demoProfiles()
    .map(
      (profile, index) =>
        `id: ${index} or "${profile.value}"\n    Name: ${profile.name}\n    Tag : google\n--------`,
    )
    .join("\n");
}

function simctlListJson(): string {
  if (sandboxOs() !== "macos") {
    return JSON.stringify({ devices: {} });
  }
  const stored = new Map(
    [...store.listStoredDevices(DEMO_PLATFORM.ios), ...store.listStoredDevices(DEMO_PLATFORM.watchos)].map(
      (row) => [row.name, row.IsRunning],
    ),
  );
  const devices: Record<string, object[]> = {};
  for (const device of [...DEMO.ios, ...DEMO.watchos]) {
    const runtimeKey = `com.apple.CoreSimulator.SimRuntime.${device.runtime}`;
    const display = appleDeviceLabel(device.name, device.runtime);
    const running = stored.get(display) ?? stored.get(device.name) ?? false;
    devices[runtimeKey] ??= [];
    devices[runtimeKey].push({
      name: device.name,
      udid: device.value,
      isAvailable: true,
      state: running ? "Booted" : "Shutdown",
    });
  }
  return JSON.stringify({ devices });
}

function mockExecError(message: string): ExecOutputError {
  const error = new Error(message) as ExecOutputError;
  error.stdout = "";
  error.stderr = message;
  return error;
}

function mockExecFile(bin: string, args: string[] = []): string {
  const tool = toolBase(bin);

  if (tool === "adb") {
    if (args[0] === "devices") {
      const lines = ["List of devices attached", ...adbSerials().map((row) => `${row.serial}\tdevice`)];
      return `${lines.join("\n")}\n`;
    }
    if (args[0] === "-s" && args[2] === "emu" && args[3] === "avd" && args[4] === "name") {
      const serial = args[1];
      const row = adbSerials().find((item) => item.serial === serial);
      return row ? `${row.name}\nOK\n` : "OK\n";
    }
    if (
      args[0] === "-s" &&
      args[2] === "emu" &&
      (args[3] === "kill" || (args[3] === "avd" && (args[4] === "stop" || args[4] === "pause")))
    ) {
      const serial = args[1];
      const row = adbSerials().find((item) => item.serial === serial);
      if (row) {
        markAndroidStopped(row.name);
      }
      return "OK\n";
    }
    return "";
  }

  if (tool === "emulator") {
    if (args.includes("-help")) {
      return "";
    }
    if (args.includes("-list-avds")) {
      return `${androidDevices()
        .map((device) => device.name)
        .join("\n")}\n`;
    }
    return "";
  }

  if (tool === "sdkmanager") {
    if (args.some((arg) => arg === "--list" || arg.startsWith("--list"))) {
      return sdkmanagerListOutput();
    }
    const pkg = args.find((arg) => arg.startsWith("system-images;"));
    if (pkg) {
      store.addStoredSdk(DEMO_PLATFORM.android, pkg);
      return "";
    }
    return sdkmanagerListOutput();
  }

  if (tool === "avdmanager") {
    if (args[0] === "list" && args[1] === "device") {
      return avdmanagerListOutput();
    }
    if (args[0] === "create" && args[1] === "avd") {
      const name = flagValue(args, "--name");
      const pkg = flagValue(args, "--package");
      const deviceId = flagValue(args, "--device");
      if (!name) {
        throw mockExecError("avdmanager create avd is missing --name");
      }
      const parsed = pkg ? parseSystemImagePackage(pkg) : null;
      const sysdir = parsed?.sysdir ?? inferSysdir(name);
      const deviceName = deviceId ?? inferDeviceName(name);
      writeAvdFiles(name, deviceName, sysdir);
      store.upsertStoredDevice(DEMO_PLATFORM.android, name, false, { deviceName, sysdir });
      return "";
    }
    return "";
  }

  if (tool === "xcrun") {
    if (args[0] === "simctl" && args[1] === "list") {
      return simctlListJson();
    }
    if (args[0] === "simctl" && args[1] === "boot") {
      const udid = args[2];
      const device =
        DEMO.ios.find((item) => item.value === udid) ?? DEMO.watchos.find((item) => item.value === udid);
      const runtime = device ? appleRuntimeFromKey(device.runtime) : null;
      const display = device ? appleDeviceLabel(device.name, device.runtime) : udid;
      const platform = runtime?.os === "watchos" ? DEMO_PLATFORM.watchos : DEMO_PLATFORM.ios;
      if (display) {
        store.upsertStoredDevice(platform, display, true);
      }
      hooks.onDeviceStart?.(
        runtime?.os === "watchos" ? "wear" : "ios",
        display || udid || "iPhone",
        udid ?? display ?? "iPhone",
      );
      return "";
    }
    if (args[0] === "simctl" && args[1] === "shutdown") {
      const udid = args[2];
      if (udid) {
        markAppleStopped(udid);
      }
      return "";
    }
    return "";
  }

  return "";
}

class FakeChild extends EventEmitter {
  pid: number;
  stdin = {
    write: () => true,
    end: () => undefined,
    on: () => this.stdin,
  };

  constructor(pid: number, exitCode = 0) {
    super();
    this.pid = pid;
    queueMicrotask(() => this.emit("exit", exitCode));
  }

  unref(): void {
    // detached fake process
  }
}

function mockSpawn(
  bin: string,
  args: string[] = [],
): FakeChild {
  const tool = toolBase(bin);
  if (tool === "emulator") {
    const avd = flagValue(args, "-avd");
    if (avd) {
      store.upsertStoredDevice(DEMO_PLATFORM.android, avd, true);
      hooks.onDeviceStart?.(
        deviceKind(avd, androidDevices().find((device) => device.name === avd)),
        avd,
        avd,
      );
    }
    return new FakeChild(DEMO_PIDS.android);
  }
  if (tool === "sdkmanager") {
    const pkg = args.find((arg) => arg.startsWith("system-images;"));
    if (pkg) {
      store.addStoredSdk(DEMO_PLATFORM.android, pkg);
    }
    return new FakeChild(DEMO_PIDS.android);
  }
  if (tool === "open") {
    return new FakeChild(DEMO_PIDS.ios);
  }
  return new FakeChild(DEMO_PIDS.android);
}

function writeAvdFiles(name: string, deviceName: string, sysdir: string): void {
  const avdDir = path.resolve(MOCK_AVD_HOME, `${name}.avd`);
  fileWrites.set(path.resolve(MOCK_AVD_HOME, `${name}.ini`), `path=${avdDir}\n`);
  fileWrites.set(
    path.resolve(avdDir, "config.ini"),
    `hw.device.name=${deviceName}\nimage.sysdir.1=${sysdir}/\nhw.keyboard=yes\n`,
  );
}

function generatedFiles(): Map<string, string> {
  const files = new Map(fileWrites);
  for (const device of androidDevices()) {
    const ini = path.resolve(MOCK_AVD_HOME, `${device.name}.ini`);
    const config = path.resolve(MOCK_AVD_HOME, `${device.name}.avd`, "config.ini");
    if (!files.has(ini)) {
      files.set(ini, `path=${path.resolve(MOCK_AVD_HOME, `${device.name}.avd`)}\n`);
    }
    if (!files.has(config)) {
      files.set(
        config,
        `hw.device.name=${device.deviceName}\nimage.sysdir.1=${device.sysdir}/\nhw.keyboard=yes\n`,
      );
    }
  }
  return files;
}

function imageDirs(): string[] {
  const dirs = new Set<string>([
    MOCK_SDK_ROOT,
    path.join(MOCK_SDK_ROOT, "system-images"),
    path.join(MOCK_SDK_ROOT, "emulator"),
    path.join(MOCK_SDK_ROOT, "platform-tools"),
    path.join(MOCK_SDK_ROOT, "cmdline-tools"),
    path.join(MOCK_SDK_ROOT, "cmdline-tools", "latest"),
    path.join(MOCK_SDK_ROOT, "cmdline-tools", "latest", "bin"),
    MOCK_AVD_HOME,
  ]);
  for (const pkg of installedPackages()) {
    const parsed = parseSystemImagePackage(pkg);
    if (!parsed) {
      continue;
    }
    const apiPath = path.join(MOCK_SDK_ROOT, "system-images", parsed.apiDir);
    const tagPath = path.join(apiPath, parsed.tag);
    const abiPath = path.join(tagPath, parsed.abi);
    dirs.add(apiPath);
    dirs.add(tagPath);
    dirs.add(abiPath);
  }
  for (const device of androidDevices()) {
    dirs.add(path.join(MOCK_AVD_HOME, `${device.name}.avd`));
    if (device.sysdir) {
      const rel = device.sysdir.replace(/\/$/, "");
      const abs = path.join(MOCK_SDK_ROOT, rel);
      const tagPath = path.dirname(abs);
      const apiPath = path.dirname(tagPath);
      dirs.add(apiPath);
      dirs.add(tagPath);
      dirs.add(abs);
    }
  }
  return [...dirs];
}

function childrenOf(dir: string): string[] {
  const prefix = dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`;
  const names = new Set<string>();
  for (const candidate of imageDirs()) {
    if (candidate.startsWith(prefix)) {
      const rest = candidate.slice(prefix.length);
      const name = rest.split(path.sep)[0];
      if (name) {
        names.add(name);
      }
    }
  }
  for (const filePath of generatedFiles().keys()) {
    if (filePath.startsWith(prefix)) {
      const rest = filePath.slice(prefix.length);
      const name = rest.split(path.sep)[0];
      if (name) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

function mockExistsSync(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  if (imageDirs().includes(resolved)) {
    return true;
  }
  if (generatedFiles().has(resolved)) {
    return true;
  }
  return (
    resolved === MOCK_ADB ||
    resolved === MOCK_EMULATOR ||
    resolved === MOCK_AVDMANAGER ||
    resolved === MOCK_SDKMANAGER
  );
}

function mockReaddirSync(filePath: string): string[] {
  return childrenOf(path.resolve(filePath));
}

function mockStatSync(filePath: string): { isDirectory(): boolean } {
  const resolved = path.resolve(filePath);
  const directory = imageDirs().includes(resolved);
  return {
    isDirectory: () => directory,
  };
}

function mockReadFileSync(filePath: string): string {
  const contents = generatedFiles().get(path.resolve(filePath));
  if (contents === undefined) {
    throw new Error(`ENOENT: ${filePath}`);
  }
  return contents;
}

function mockWriteFileSync(filePath: string, contents: string): void {
  fileWrites.set(path.resolve(filePath), contents);
}

  return {
    mockExecFile,
    mockSpawn,
    mockExistsSync,
    mockReaddirSync,
    mockStatSync,
    mockReadFileSync,
    mockWriteFileSync,
  };
}

export function isMockFsPath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return (
    resolved === MOCK_SDK_ROOT ||
    resolved.startsWith(`${MOCK_SDK_ROOT}${path.sep}`) ||
    resolved === MOCK_AVD_HOME ||
    resolved.startsWith(`${MOCK_AVD_HOME}${path.sep}`) ||
    resolved === MOCK_AVDMANAGER ||
    resolved === MOCK_EMULATOR ||
    resolved === MOCK_SDKMANAGER
  );
}

export function isMockLogPath(filePath: string): boolean {
  return path.resolve(filePath) === path.resolve(EMULATOR_LOG);
}
