import fs from "node:fs";

import { isSimulate, simulateFs } from "../demo/mode.js";

export function existsSync(filePath: string): boolean {
  if (isSimulate()) {
    const mocks = simulateFs();
    if (mocks.isMockFsPath(filePath)) {
      return mocks.mockExistsSync(filePath);
    }
  }
  return fs.existsSync(filePath);
}

export function readdirSync(filePath: string): string[] {
  if (isSimulate()) {
    const mocks = simulateFs();
    if (mocks.isMockFsPath(filePath)) {
      return mocks.mockReaddirSync(filePath);
    }
  }
  return fs.readdirSync(filePath);
}

export function statSync(filePath: string): { isDirectory(): boolean } {
  if (isSimulate()) {
    const mocks = simulateFs();
    if (mocks.isMockFsPath(filePath)) {
      return mocks.mockStatSync(filePath);
    }
  }
  return fs.statSync(filePath);
}

export function readFileSync(filePath: string, encoding: BufferEncoding = "utf8"): string {
  if (isSimulate()) {
    const mocks = simulateFs();
    if (mocks.isMockFsPath(filePath)) {
      return mocks.mockReadFileSync(filePath);
    }
  }
  return fs.readFileSync(filePath, encoding);
}

export function writeFileSync(filePath: string, contents: string): void {
  if (isSimulate()) {
    const mocks = simulateFs();
    if (mocks.isMockFsPath(filePath)) {
      mocks.mockWriteFileSync(filePath, contents);
      return;
    }
  }
  fs.writeFileSync(filePath, contents);
}

export function openSync(filePath: string, flags: string): number {
  if (isSimulate() && simulateFs().isMockLogPath(filePath)) {
    return fs.openSync(process.platform === "win32" ? "NUL" : "/dev/null", flags);
  }
  return fs.openSync(filePath, flags);
}

export function closeSync(fd: number): void {
  fs.closeSync(fd);
}

export function rmSync(filePath: string): void {
  if (isSimulate()) {
    const mocks = simulateFs();
    if (mocks.isMockFsPath(filePath)) {
      return;
    }
  }
  fs.rmSync(filePath, { recursive: true, force: true });
}
