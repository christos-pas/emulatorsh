export type AppleOs = "ios" | "watchos";

export interface AppleRuntime {
  os: AppleOs;
  version: string;
  label: string;
}

export function appleRuntimeFromKey(runtimeKey: string): AppleRuntime | null {
  const match = runtimeKey.match(/(watchOS|iOS)-(\d+)(?:-(\d+))?/i);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  const os: AppleOs = /watchos/i.test(match[1]) ? "watchos" : "ios";
  const version = match[3] ? `${match[2]}.${match[3]}` : match[2];
  return {
    os,
    version,
    label: os === "watchos" ? "watchOS" : "iOS",
  };
}

export function iosVersionFromRuntime(runtimeKey: string): string | null {
  const parsed = appleRuntimeFromKey(runtimeKey);
  return parsed?.os === "ios" ? parsed.version : null;
}

export function watchOsVersionFromRuntime(runtimeKey: string): string | null {
  const parsed = appleRuntimeFromKey(runtimeKey);
  return parsed?.os === "watchos" ? parsed.version : null;
}

export function appleDeviceLabel(name: string, runtimeKey: string): string {
  const parsed = appleRuntimeFromKey(runtimeKey);
  if (!parsed) {
    return name;
  }
  return `${name} (${parsed.label} ${parsed.version})`;
}
