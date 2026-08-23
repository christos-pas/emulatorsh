import { getSystem } from "./context";

export function existsSync(filePath: string): boolean {
  return getSystem().fs.existsSync(filePath);
}

export function readdirSync(filePath: string): string[] {
  return getSystem().fs.readdirSync(filePath);
}

export function statSync(filePath: string): { isDirectory(): boolean } {
  return getSystem().fs.statSync(filePath);
}

export function readFileSync(filePath: string, encoding: BufferEncoding = "utf8"): string {
  return getSystem().fs.readFileSync(filePath, encoding);
}

export function writeFileSync(filePath: string, contents: string): void {
  getSystem().fs.writeFileSync(filePath, contents);
}

export function openSync(filePath: string, flags: string): number {
  return getSystem().fs.openSync(filePath, flags);
}

export function closeSync(fd: number): void {
  getSystem().fs.closeSync(fd);
}

export function rmSync(filePath: string): void {
  getSystem().fs.rmSync(filePath);
}
