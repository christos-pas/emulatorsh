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
import { clearSandboxStorage, createSandboxStore, demoDbPath, type SandboxStore } from "./store";
import {
  createSandboxTools,
  isMockFsPath,
  isMockLogPath,
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
  readonly store: SandboxStore;
  clear(): { path: string; removed: boolean };
}

function createSandboxFs(tools: ReturnType<typeof createSandboxTools>): SystemFs {
  return {
    existsSync(filePath) {
      if (isMockFsPath(filePath)) {
        return tools.mockExistsSync(filePath);
      }
      return fs.existsSync(filePath);
    },
    readdirSync(filePath) {
      if (isMockFsPath(filePath)) {
        return tools.mockReaddirSync(filePath);
      }
      return fs.readdirSync(filePath);
    },
    statSync(filePath) {
      if (isMockFsPath(filePath)) {
        return tools.mockStatSync(filePath);
      }
      return fs.statSync(filePath);
    },
    readFileSync(filePath, encoding = "utf8") {
      if (isMockFsPath(filePath)) {
        return tools.mockReadFileSync(filePath);
      }
      return fs.readFileSync(filePath, encoding);
    },
    writeFileSync(filePath, contents) {
      if (isMockFsPath(filePath)) {
        tools.mockWriteFileSync(filePath, contents);
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
  const store = createSandboxStore(options.storage);
  const tools = createSandboxTools({
    os: options.os,
    store,
    onDeviceStart: options.onDeviceStart,
    onDeviceStop: options.onDeviceStop,
  });

  return {
    kind: "sandbox",
    os: options.os,
    store,
    env: {
      get(name) {
        return process.env[name];
      },
    },
    exec(bin, args = []) {
      return tools.mockExecFile(bin, args);
    },
    spawn(bin, args = [], _options?: SpawnOptions) {
      return tools.mockSpawn(bin, args) as unknown as ReturnType<System["spawn"]>;
    },
    fs: createSandboxFs(tools),
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
      return store.clear();
    },
  };
}

export { clearSandboxStorage, demoDbPath };
export type { SandboxDeviceKind };
