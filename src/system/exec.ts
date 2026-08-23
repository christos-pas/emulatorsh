import type { SpawnOptions } from "node:child_process";

import type { ExecOptions, System } from "./types";

export function runFile(system: System, bin: string, args: string[] = [], options: ExecOptions = {}): string {
  return system.exec(bin, args, options);
}

export function spawnProcess(system: System, bin: string, args: string[] = [], options: SpawnOptions = {}) {
  return system.spawn(bin, args, options);
}
