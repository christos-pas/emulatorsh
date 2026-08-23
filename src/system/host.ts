import { execFileSync, spawn, type SpawnOptions } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { hostOsFromPlatform } from "./os";
import type { ExecOptions, System, SystemFs, SystemPaths } from "./types";

export interface HostSystemOptions {
  androidSdkRoot?: string;
  avdHome?: string;
  env?: NodeJS.ProcessEnv;
  os?: System["os"];
}

const liveFs: SystemFs = {
  existsSync: (filePath) => fs.existsSync(filePath),
  readdirSync: (filePath) => fs.readdirSync(filePath),
  statSync: (filePath) => fs.statSync(filePath),
  readFileSync: (filePath, encoding = "utf8") => fs.readFileSync(filePath, encoding),
  writeFileSync: (filePath, contents) => {
    fs.writeFileSync(filePath, contents);
  },
  openSync: (filePath, flags) => fs.openSync(filePath, flags),
  closeSync: (fd) => {
    fs.closeSync(fd);
  },
  rmSync: (filePath) => {
    fs.rmSync(filePath, { recursive: true, force: true });
  },
};

function liveExec(bin: string, args: string[] = [], options: ExecOptions = {}): string {
  return execFileSync(bin, args, options as Parameters<typeof execFileSync>[2]) as unknown as string;
}

function liveSpawn(bin: string, args: string[] = [], options: SpawnOptions = {}) {
  return spawn(bin, args, options);
}

function firstExisting(
  fsApi: SystemFs,
  exec: System["exec"],
  candidates: string[],
): string | null {
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) || candidate.startsWith(".")) {
      if (fsApi.existsSync(candidate)) {
        return candidate;
      }
      continue;
    }
    try {
      exec(candidate, ["-help"], { stdio: "ignore" });
      return candidate;
    } catch {
      // not on PATH
    }
  }
  return null;
}

function createHostPaths(options: {
  env: { get(name: string): string | undefined };
  fs: SystemFs;
  exec: System["exec"];
  androidSdkRoot?: string;
  avdHome?: string;
}): SystemPaths {
  const homeDir = (): string => os.homedir();

  const sdkRootCandidates = (): string[] =>
    [
      options.androidSdkRoot,
      options.env.get("ANDROID_SDK_ROOT"),
      options.env.get("ANDROID_HOME"),
      path.join(homeDir(), "Library/Android/sdk"),
      path.join(homeDir(), "Android/Sdk"),
    ].filter((candidate): candidate is string => Boolean(candidate));

  const paths: SystemPaths = {
    homeDir,
    emulator() {
      return firstExisting(options.fs, options.exec, [
        ...sdkRootCandidates().map((root) => path.join(root, "emulator", "emulator")),
        "emulator",
      ]);
    },
    sdkRoot() {
      for (const root of sdkRootCandidates()) {
        if (options.fs.existsSync(root)) {
          return root;
        }
      }
      const emulatorBin = paths.emulator();
      if (emulatorBin && emulatorBin !== "emulator") {
        return path.dirname(path.dirname(emulatorBin));
      }
      return null;
    },
    adb() {
      return firstExisting(options.fs, options.exec, [
        ...sdkRootCandidates().map((root) => path.join(root, "platform-tools", "adb")),
        "adb",
      ]);
    },
    avdmanager() {
      const sdkRoot = paths.sdkRoot();
      const candidates: string[] = [];
      if (sdkRoot) {
        const cmdline = path.join(sdkRoot, "cmdline-tools");
        candidates.push(path.join(cmdline, "latest", "bin", "avdmanager"));
        if (options.fs.existsSync(cmdline)) {
          for (const entry of options.fs.readdirSync(cmdline)) {
            candidates.push(path.join(cmdline, entry, "bin", "avdmanager"));
          }
        }
        candidates.push(path.join(sdkRoot, "tools", "bin", "avdmanager"));
      }
      candidates.push("avdmanager");
      return firstExisting(options.fs, options.exec, candidates);
    },
    sdkmanager() {
      const sdkRoot = paths.sdkRoot();
      const candidates: string[] = [];
      if (sdkRoot) {
        const cmdline = path.join(sdkRoot, "cmdline-tools");
        candidates.push(path.join(cmdline, "latest", "bin", "sdkmanager"));
        if (options.fs.existsSync(cmdline)) {
          for (const entry of options.fs.readdirSync(cmdline)) {
            candidates.push(path.join(cmdline, entry, "bin", "sdkmanager"));
          }
        }
        candidates.push(path.join(sdkRoot, "tools", "bin", "sdkmanager"));
      }
      candidates.push("sdkmanager");
      return firstExisting(options.fs, options.exec, candidates);
    },
    avdHome() {
      return options.avdHome || options.env.get("ANDROID_AVD_HOME") || path.join(homeDir(), ".android", "avd");
    },
  };

  return paths;
}

export function createHostSystem(options: HostSystemOptions = {}): System {
  const env = {
    get(name: string): string | undefined {
      return options.env?.[name] ?? process.env[name];
    },
  };
  return {
    kind: "host",
    os: options.os ?? hostOsFromPlatform(),
    env,
    exec: liveExec,
    spawn: liveSpawn,
    fs: liveFs,
    paths: createHostPaths({
      env,
      fs: liveFs,
      exec: liveExec,
      androidSdkRoot: options.androidSdkRoot,
      avdHome: options.avdHome,
    }),
  };
}
