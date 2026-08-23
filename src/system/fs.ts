import type { System } from "./types";

export function existsSync(system: System, filePath: string): boolean {
  return system.fs.existsSync(filePath);
}

export function readdirSync(system: System, filePath: string): string[] {
  return system.fs.readdirSync(filePath);
}

export function statSync(system: System, filePath: string): { isDirectory(): boolean } {
  return system.fs.statSync(filePath);
}

export function readFileSync(system: System, filePath: string, encoding: BufferEncoding = "utf8"): string {
  return system.fs.readFileSync(filePath, encoding);
}

export function writeFileSync(system: System, filePath: string, contents: string): void {
  system.fs.writeFileSync(filePath, contents);
}

export function openSync(system: System, filePath: string, flags: string): number {
  return system.fs.openSync(filePath, flags);
}

export function closeSync(system: System, fd: number): void {
  system.fs.closeSync(fd);
}

export function rmSync(system: System, filePath: string): void {
  system.fs.rmSync(filePath);
}
