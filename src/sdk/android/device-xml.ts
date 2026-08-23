import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

import { isSandbox } from "../../system/context";
import { apiInRange, parseApiLevelRange } from "./specs";
import { resolveAvdmanager } from "./sdk";

export interface DeviceSoftware {
  id: string;
  name: string;
  apiMin?: number;
  apiMax?: number;
  hasPlayStore?: boolean;
  tagId?: string;
}

const JAR_XML = [
  "com/android/sdklib/devices/devices.xml",
  "com/android/sdklib/devices/nexus.xml",
  "com/android/sdklib/devices/wear.xml",
];

let cached: Map<string, DeviceSoftware> | undefined;

export function loadDeviceSoftware(): Map<string, DeviceSoftware> {
  if (cached) {
    return cached;
  }
  cached = new Map();
  if (isSandbox()) {
    return cached;
  }
  for (const jar of sdklibJars()) {
    for (const entry of JAR_XML) {
      const xml = readZipText(jar, entry);
      if (xml) {
        mergeDeviceSoftware(cached, parseDevicesXml(xml));
      }
    }
  }
  const userXml = path.join(process.env.HOME || "", ".android", "devices.xml");
  if (userXml && fs.existsSync(userXml)) {
    try {
      mergeDeviceSoftware(cached, parseDevicesXml(fs.readFileSync(userXml, "utf8")));
    } catch {
      // ignore unreadable user device definitions
    }
  }
  return cached;
}

export function parseDevicesXml(xml: string): DeviceSoftware[] {
  const devices: DeviceSoftware[] = [];
  const blocks = xml.split(/<d:device\b[^>]*>/i).slice(1);
  for (const block of blocks) {
    const body = block.split(/<\/d:device>/i)[0] ?? block;
    const id = xmlText(body, "id");
    const name = xmlText(body, "name");
    if (!id || !name) {
      continue;
    }
    const api = parseApiLevelRange(xmlText(body, "api-level") ?? "-");
    const playRaw = xmlText(body, "playstore-enabled") ?? xmlText(body, "play-store-enabled");
    const tagId = xmlText(body, "tag-id") ?? undefined;
    const device: DeviceSoftware = { id, name, tagId };
    if (api.min !== undefined) {
      device.apiMin = api.min;
    }
    if (api.max !== undefined) {
      device.apiMax = api.max;
    }
    if (playRaw !== undefined) {
      device.hasPlayStore = /^(1|true|yes)$/i.test(playRaw);
    }
    devices.push(device);
  }
  return devices;
}

export function specSupportedByDevice(
  specApi: string,
  specTag: string,
  device: Pick<DeviceSoftware, "apiMin" | "apiMax" | "hasPlayStore">,
): boolean {
  if (!apiInRange(specApi, device.apiMin, device.apiMax)) {
    return false;
  }
  if (/playstore/i.test(specTag) && device.hasPlayStore === false) {
    return false;
  }
  return true;
}

function xmlText(block: string, localName: string): string | undefined {
  const match = block.match(new RegExp(`<(?:[a-zA-Z0-9]+:)?${localName}(?:\\s[^>]*)?>([^<]*)</(?:[a-zA-Z0-9]+:)?${localName}>`, "i"));
  return match?.[1]?.trim();
}

function mergeDeviceSoftware(into: Map<string, DeviceSoftware>, devices: DeviceSoftware[]): void {
  for (const device of devices) {
    if (!into.has(device.id)) {
      into.set(device.id, device);
    }
  }
}

function sdklibJars(): string[] {
  const avdmanager = resolveAvdmanager();
  if (!avdmanager || !avdmanager.includes(path.sep)) {
    return [];
  }
  const lib = path.resolve(path.dirname(avdmanager), "..", "lib", "sdklib");
  if (!fs.existsSync(lib)) {
    return [];
  }
  return ["tools.sdklib.jar", "sdklib.core.jar"]
    .map((name) => path.join(lib, name))
    .filter((file) => fs.existsSync(file));
}

function readZipText(jarPath: string, entryName: string): string | null {
  const bytes = readZipEntry(jarPath, entryName);
  return bytes ? bytes.toString("utf8") : null;
}

function readZipEntry(jarPath: string, entryName: string): Buffer | null {
  let data: Buffer;
  try {
    data = fs.readFileSync(jarPath);
  } catch {
    return null;
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const eocd = findEocd(data);
  if (eocd < 0) {
    return null;
  }
  const cdOffset = view.getUint32(eocd + 16, true);
  const cdEntries = view.getUint16(eocd + 10, true);
  let offset = cdOffset;
  for (let i = 0; i < cdEntries && offset + 46 <= data.length; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      break;
    }
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const name = data.subarray(offset + 46, offset + 46 + nameLen).toString("utf8");
    if (name === entryName) {
      const compression = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const localOffset = view.getUint32(offset + 42, true);
      if (view.getUint32(localOffset, true) !== 0x04034b50) {
        return null;
      }
      const localNameLen = view.getUint16(localOffset + 26, true);
      const localExtraLen = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localNameLen + localExtraLen;
      const compressed = data.subarray(start, start + compressedSize);
      if (compression === 0) {
        return Buffer.from(compressed);
      }
      if (compression === 8) {
        return zlib.inflateRawSync(compressed);
      }
      return null;
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function findEocd(data: Buffer): number {
  const maxComment = 65535;
  const start = Math.max(0, data.length - 22 - maxComment);
  for (let i = data.length - 22; i >= start; i -= 1) {
    if (data[i] === 0x50 && data[i + 1] === 0x4b && data[i + 2] === 0x05 && data[i + 3] === 0x06) {
      return i;
    }
  }
  return -1;
}
