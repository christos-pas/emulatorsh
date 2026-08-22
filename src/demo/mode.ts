import type { ImageSpec } from "../types.js";

export interface SimulateExec {
  mockExecFile(bin: string, args?: string[]): string;
  mockSpawn(bin: string, args?: string[]): { pid?: number; unref(): void };
}

export interface SimulateFs {
  isMockFsPath(filePath: string): boolean;
  isMockLogPath(filePath: string): boolean;
  mockExistsSync(filePath: string): boolean;
  mockReadFileSync(filePath: string): string;
  mockReaddirSync(filePath: string): string[];
  mockStatSync(filePath: string): { isDirectory(): boolean };
  mockWriteFileSync(filePath: string, contents: string): void;
}

let simulate = false;
let execMocks: SimulateExec | undefined;
let fsMocks: SimulateFs | undefined;
let profileSdks: Map<string, ImageSpec[]> | undefined;

export function isSimulate(): boolean {
  return simulate;
}

export function enableSimulate(options: {
  exec: SimulateExec;
  fs: SimulateFs;
  profileSdks: Map<string, ImageSpec[]>;
}): void {
  simulate = true;
  execMocks = options.exec;
  fsMocks = options.fs;
  profileSdks = options.profileSdks;
}

export function simulateExec(): SimulateExec {
  if (!execMocks) {
    throw new Error("Simulate exec mocks were not installed.");
  }
  return execMocks;
}

export function simulateFs(): SimulateFs {
  if (!fsMocks) {
    throw new Error("Simulate fs mocks were not installed.");
  }
  return fsMocks;
}

export function simulateProfileSdks(): Map<string, ImageSpec[]> | undefined {
  return simulate ? profileSdks : undefined;
}
