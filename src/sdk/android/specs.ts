import type { ImageSpec, SystemImage } from "../types";

export type { ImageSpec };

export function specFromPackage(pkg: string): ImageSpec | null {
  const match = pkg.match(/^system-images;android-([^;]+);([^;]+);[^;]+$/);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return { api: match[1], tag: match[2] };
}

export function specFromSysdir(sysdir: string): ImageSpec | null {
  const match = sysdir.replace(/\/$/, "").match(/system-images\/android-([^/]+)\/([^/]+)/);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return { api: match[1], tag: match[2] };
}

export function specFromImage(image: Pick<SystemImage, "api" | "package" | "sysdir">): ImageSpec | null {
  if (image.package) {
    const fromPackage = specFromPackage(image.package);
    if (fromPackage) {
      return fromPackage;
    }
  }
  if (image.sysdir) {
    return specFromSysdir(image.sysdir);
  }
  return null;
}

export function specToPackage(spec: ImageSpec, abi: string): string {
  return `system-images;android-${spec.api};${spec.tag};${abi}`;
}

export function specToSysdir(spec: ImageSpec, abi: string): string {
  return `system-images/android-${spec.api}/${spec.tag}/${abi}`;
}

export function specKey(spec: ImageSpec): string {
  return `${spec.api};${spec.tag}`;
}

export function specsEqual(a: ImageSpec, b: ImageSpec): boolean {
  return a.api === b.api && a.tag === b.tag;
}

export function isPlayStoreSpec(spec: ImageSpec): boolean {
  return /playstore/i.test(spec.tag);
}

export function abiFromSysdir(sysdir: string): string | undefined {
  const parts = sysdir.replace(/\/$/, "").split("/");
  return parts.at(-1);
}

export function sysdirMatchesImage(sysdir: string, image: Pick<SystemImage, "api" | "package" | "sysdir">): boolean {
  const normalized = sysdir.replace(/\/$/, "");
  if (image.sysdir) {
    const imageDir = image.sysdir.replace(/\/$/, "");
    if (normalized === imageDir || normalized.startsWith(`${imageDir}/`)) {
      return true;
    }
  }
  const fromSysdir = specFromSysdir(normalized);
  const fromImage = specFromImage(image);
  return Boolean(fromSysdir && fromImage && specsEqual(fromSysdir, fromImage));
}

export function uniqueSpecs(specs: ImageSpec[]): ImageSpec[] {
  const seen = new Set<string>();
  const unique: ImageSpec[] = [];
  for (const spec of specs) {
    const key = `${spec.api};${spec.tag}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(spec);
  }
  return unique.sort((a, b) => {
    const apiDiff = Number(b.api) - Number(a.api);
    if (apiDiff !== 0) {
      return apiDiff;
    }
    return a.tag.localeCompare(b.tag);
  });
}

export function profileSupportsImage(
  supported: ImageSpec[] | undefined,
  image: Pick<SystemImage, "api" | "package" | "sysdir">,
): boolean {
  if (!supported?.length) {
    return true;
  }
  const spec = specFromImage(image);
  if (!spec) {
    return true;
  }
  return supported.some((item) => specsEqual(item, spec));
}

export function apiInRange(api: string, min?: number, max?: number): boolean {
  const value = Number(api);
  if (!Number.isFinite(value)) {
    return true;
  }
  if (min !== undefined && value < min) {
    return false;
  }
  if (max !== undefined && value > max) {
    return false;
  }
  return true;
}

export function parseApiLevelRange(raw: string): { min?: number; max?: number } {
  const text = raw.trim();
  if (!text || text === "-") {
    return {};
  }
  const range = text.match(/^(\d+)?-(\d+)?$/);
  if (range) {
    return {
      min: range[1] ? Number(range[1]) : undefined,
      max: range[2] ? Number(range[2]) : undefined,
    };
  }
  const exact = Number(text);
  if (Number.isFinite(exact)) {
    return { min: exact, max: exact };
  }
  return {};
}

export function isWearSpec(spec: ImageSpec): boolean {
  return /wear/i.test(spec.tag);
}
