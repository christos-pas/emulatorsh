export function imageDisplayName(api: string, tag: string, abi: string): string {
  return `API ${api} — ${tag} (${abi})`;
}

export function sanitizeAvdName(deviceName: string, api: string): string {
  const slug = deviceName.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${slug}_API_${api}`;
}

export function nextUniqueName(base: string, taken: Iterable<string>): string {
  const names = taken instanceof Set ? taken : new Set(taken);
  if (!names.has(base)) {
    return base;
  }
  let suffix = 2;
  while (names.has(`${base}_${suffix}`)) {
    suffix += 1;
  }
  return `${base}_${suffix}`;
}

export function proposedAvdName(deviceName: string, api: string, taken: Iterable<string>): string {
  return nextUniqueName(sanitizeAvdName(deviceName, api), taken);
}

/** API encoded in an AVD name such as `Pixel_9_API_36` or `Galaxy_Nexus_API_37.2-beta2_3`. */
export function parseAvdApi(avdName: string, knownApis: Iterable<string>): string | undefined {
  const apis = [...new Set(knownApis)].sort((a, b) => b.length - a.length);
  for (const api of apis) {
    const escaped = api.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`_API_${escaped}(?:_[2-9]|_[1-9]\\d+)?$`).test(avdName)) {
      return api;
    }
  }
  return undefined;
}
