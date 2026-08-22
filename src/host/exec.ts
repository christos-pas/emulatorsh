import { execFileSync, spawn, type SpawnOptions } from "node:child_process";

import { isSimulate, simulateExec } from "../demo/mode.js";

type ExecOptions = {
  encoding?: BufferEncoding;
  stdio?: unknown;
  input?: string;
  maxBuffer?: number;
};

export function runFile(bin: string, args: string[] = [], options: ExecOptions = {}): string {
  if (isSimulate()) {
    return simulateExec().mockExecFile(bin, args);
  }
  return execFileSync(bin, args, options as Parameters<typeof execFileSync>[2]) as unknown as string;
}

export function spawnProcess(bin: string, args: string[] = [], options: SpawnOptions = {}) {
  if (isSimulate()) {
    return simulateExec().mockSpawn(bin, args) as unknown as ReturnType<typeof spawn>;
  }
  return spawn(bin, args, options);
}
