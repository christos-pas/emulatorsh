import fs from "node:fs";
import os from "node:os";
import type { SpawnOptions } from "node:child_process";

import { demoProfiles } from "./data";
import {
  MOCK_ADB,
  MOCK_AVD_HOME,
  MOCK_AVDMANAGER,
  MOCK_EMULATOR,
  MOCK_SDK_ROOT,
  MOCK_SDKMANAGER,
} from "./paths";
import { clearDemoDb, configureDemoDbPath, demoDbPath, openDemoDb } from "./store";
import {
  configureSandboxTools,
  isMockFsPath,
  isMockLogPath,
  mockExecFile,
  mockExistsSync,
  mockReadFileSync,
  mockReaddirSync,
  mockSpawn,
  mockStatSync,
  mockWriteFileSync,
  type SandboxDeviceKind,
  type SandboxHooks,
} from "./tools";
import type { HostOs, System, SystemFs } from "../system/types";

export interface SandboxSystemOptions extends SandboxHooks {
  os: HostOs;
  storage: string;
}

export interface SandboxSystem extends System {
  readonly kind: "sandbox";
  clear(): { path: string; removed: boolean };
}

function createSandboxFs(): SystemFs {
  return {
    existsSync(filePath) {
      if (isMockFsPath(filePath)) {
        return mockExistsSync(filePath);
      }
      return fs.existsSync(filePath);
    },
    readdirSync(filePath) {
      if (isMockFsPath(filePath)) {
        return mockReaddirSync(filePath);
      }
      return fs.readdirSync(filePath);
    },
    statSync(filePath) {
      if (isMockFsPath(filePath)) {
        return mockStatSync(filePath);
      }
      return fs.statSync(filePath);
    },
    readFileSync(filePath, encoding = "utf8") {
      if (isMockFsPath(filePath)) {
        return mockReadFileSync(filePath);
      }
      return fs.readFileSync(filePath, encoding);
    },
    writeFileSync(filePath, contents) {
      if (isMockFsPath(filePath)) {
        mockWriteFileSync(filePath, contents);
        return;
      }
      fs.writeFileSync(filePath, contents);
    },
    openSync(filePath, flags) {
      if (isMockLogPath(filePath)) {
        return fs.openSync(process.platform === "win32" ? "NUL" : "/dev/null", flags);
      }
      return fs.openSync(filePath, flags);
    },
    closeSync(fd) {
      fs.closeSync(fd);
    },
    rmSync(filePath) {
      if (isMockFsPath(filePath)) {
        return;
      }
      fs.rmSync(filePath, { recursive: true, force: true });
    },
  };
}

export function createSandboxSystem(options: SandboxSystemOptions): SandboxSystem {
  configureSandboxTools({
    os: options.os,
    onDeviceStart: options.onDeviceStart,
    onDeviceStop: options.onDeviceStop,
  });
  configureDemoDbPath(options.storage);
  openDemoDb();

  return {
    kind: "sandbox",
    os: options.os,
    env: {
      get(name) {
        return process.env[name];
      },
    },
    exec(bin, args = []) {
      return mockExecFile(bin, args);
    },
    spawn(bin, args = [], _options?: SpawnOptions) {
      return mockSpawn(bin, args) as unknown as ReturnType<System["spawn"]>;
    },
    fs: createSandboxFs(),
    paths: {
      homeDir: () => os.homedir(),
      sdkRoot: () => MOCK_SDK_ROOT,
      emulator: () => MOCK_EMULATOR,
      adb: () => MOCK_ADB,
      avdmanager: () => MOCK_AVDMANAGER,
      sdkmanager: () => MOCK_SDKMANAGER,
      avdHome: () => MOCK_AVD_HOME,
    },
    profileSdks: new Map(
      demoProfiles().map((profile) => [profile.value, profile.supportedSdks]),
    ),
    clear() {
      return clearDemoDb();
    },
  };
}

export function clearSandboxStorage(storage = demoDbPath()): { path: string; removed: boolean } {
  configureDemoDbPath(storage);
  return clearDemoDb();
}

export type { SandboxDeviceKind };
