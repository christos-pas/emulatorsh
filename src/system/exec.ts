import type { SpawnOptions } from "node:child_process";

import { getSystem } from "./context";
import type { ExecOptions } from "./types";

export function runFile(bin: string, args: string[] = [], options: ExecOptions = {}): string {
  return getSystem().exec(bin, args, options);
}

export function spawnProcess(bin: string, args: string[] = [], options: SpawnOptions = {}) {
  return getSystem().spawn(bin, args, options);
}
