import { createHostSystem } from "./host";
import type { System } from "./types";

let current: System | undefined;

export function bindSystem(system: System): void {
  current = system;
}

export function boundSystem(): System | undefined {
  return current;
}

export function getSystem(): System {
  if (!current) {
    current = createHostSystem();
  }
  return current;
}

export function isSandbox(): boolean {
  return getSystem().kind === "sandbox";
}
