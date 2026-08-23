import type { ChildProcess, SpawnOptions } from "node:child_process";

export type HostOs = "macos" | "linux" | "windows";

export type ExecOptions = {
  encoding?: BufferEncoding;
  stdio?: unknown;
  input?: string;
  maxBuffer?: number;
};

export interface SystemFs {
  existsSync(filePath: string): boolean;
  readdirSync(filePath: string): string[];
  statSync(filePath: string): { isDirectory(): boolean };
  readFileSync(filePath: string, encoding?: BufferEncoding): string;
  writeFileSync(filePath: string, contents: string): void;
  openSync(filePath: string, flags: string): number;
  closeSync(fd: number): void;
  rmSync(filePath: string): void;
}

export interface SystemPaths {
  homeDir(): string;
  sdkRoot(): string | null;
  emulator(): string | null;
  adb(): string | null;
  avdmanager(): string | null;
  sdkmanager(): string | null;
  avdHome(): string;
}

export interface System {
  readonly kind: "host" | "sandbox";
  readonly os: HostOs;
  env: { get(name: string): string | undefined };
  exec(bin: string, args?: string[], options?: ExecOptions): string;
  spawn(bin: string, args?: string[], options?: SpawnOptions): ChildProcess;
  fs: SystemFs;
  paths: SystemPaths;
  profileSdks?: Map<string, { api: string; tag: string }[]>;
}

export type { ChildProcess, SpawnOptions };
