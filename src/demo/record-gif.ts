import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { Resvg } from "@resvg/resvg-js";

import { CREATE_VALUE, INSTALL_SDK_VALUE } from "../constants.js";
import { installSdkOption } from "../android/images.js";
import { profileSupportsImage } from "../android/specs.js";
import { main } from "../flows.js";
import { createDemoCatalog } from "./data.js";
import { createDemoRuntime, type DemoFrame } from "./runtime.js";
import { FONT, frameToSvg, typeCommandFrames } from "./svg.js";
import { moveSelection, type ScriptedKey } from "../ui/prompt.js";
import type { MenuItem } from "../types.js";

const DELAY_SCALE = 1.3;
const WIDTH = 760;
const HEIGHT = 360;
const SCALE = 2;
const TITLE_IOS = "Launch iOS emulator";
const TITLE_ANDROID = "Create and Launch Android Emulator";

const here = path.dirname(fileURLToPath(import.meta.url));

function repoRootFrom(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.resolve(dir, "..");
  }
  return path.resolve(start, "..");
}

const repoRoot = repoRootFrom(here);
const outGif = path.join(repoRoot, "docs/screens/usage.gif");
const bundledFont = path.join(repoRoot, "docs/screens/fonts/JetBrainsMono-Regular.ttf");
const systemFonts = [
  "/System/Library/Fonts/Menlo.ttc",
  "/System/Library/Fonts/Monaco.ttf",
  "/Library/Fonts/Menlo.ttc",
];

function fontFiles(): string[] {
  return [...systemFonts, bundledFont].filter((file) => fs.existsSync(file));
}

function setColumns(columns: number): void {
  Object.defineProperty(process.stdout, "columns", {
    configurable: true,
    get: () => columns,
  });
}

async function encodeGif(frames: DemoFrame[]): Promise<Buffer> {
  const fonts = fontFiles();
  if (fonts.length === 0) {
    throw new Error(
      `No mono font found. Add ${bundledFont} or install Menlo/JetBrains Mono.`,
    );
  }

  const gif = GIFEncoder();

  for (const [index, frame] of frames.entries()) {
    const svg = frameToSvg(frame);
    const resvg = new Resvg(svg, {
      fitTo: { mode: "zoom", value: SCALE },
      font: {
        fontFiles: fonts,
        loadSystemFonts: true,
        defaultFontFamily: FONT.split(",")[0]?.trim() || "Menlo",
      },
    });
    const rendered = resvg.render();
    if (index === 0 && (rendered.width !== WIDTH * SCALE || rendered.height !== HEIGHT * SCALE)) {
      throw new Error(
        `Unexpected GIF size ${rendered.width}x${rendered.height}; expected ${WIDTH * SCALE}x${HEIGHT * SCALE}.`,
      );
    }
    const rgba = new Uint8Array(rendered.pixels);
    const palette = quantize(rgba, 256, { format: "rgb565" });
    const indexed = applyPalette(rgba, palette, "rgb565");
    gif.writeFrame(indexed, rendered.width, rendered.height, {
      palette,
      delay: Math.max(Math.round(frame.delay * 1000), 20),
      repeat: index === 0 ? 0 : undefined,
    });
  }

  gif.finish();
  return Buffer.from(gif.bytes());
}

function keysToSelect(items: MenuItem[], match: (item: MenuItem) => boolean, label: string): ScriptedKey[] {
  const target = items.findIndex(match);
  if (target < 0) {
    throw new Error(`GIF catalog is missing ${label}.`);
  }
  if (target === 0) {
    return ["enter"];
  }
  const queue: { index: number; path: Exclude<ScriptedKey, "enter" | "back" | "quit">[] }[] = [
    { index: 0, path: [] },
  ];
  const seen = new Set([0]);
  const dirs = ["down", "up", "right", "left"] as const;
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    for (const dir of dirs) {
      const next = moveSelection(items, current.index, dir);
      if (seen.has(next)) {
        continue;
      }
      seen.add(next);
      const path = [...current.path, dir];
      if (next === target) {
        return [...path, "enter"];
      }
      queue.push({ index: next, path });
    }
  }
  throw new Error(`Could not navigate to ${label}.`);
}

async function record(): Promise<void> {
  setColumns(80);
  const catalog = createDemoCatalog();
  const frames: DemoFrame[] = [];
  const windowTitle = { current: TITLE_IOS };
  const platforms: MenuItem[] = [
    { name: "Android", value: "android" },
    { name: "iOS", value: "ios" },
    { name: "watchOS", value: "watchos" },
  ];
  const formFactors: MenuItem[] = [
    { name: "Mobile Phone", value: "phone" },
    { name: "Wear", value: "wear" },
  ];
  const iosDevice =
    catalog.ios.find((item) => /iPhone 16 Plus/i.test(item.name)) ?? catalog.ios[2];
  if (!iosDevice) {
    throw new Error("GIF catalog has no iOS devices.");
  }
  const toInstall = catalog.available.phone.find((item) => !item.installed);
  if (!toInstall) {
    throw new Error("GIF catalog has no uninstalled phone SDK to install.");
  }
  const profiles = catalog.profiles.phone
    .filter((profile) => profileSupportsImage(profile.supportedSdks, toInstall))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const pixel =
    profiles.find((profile) => profile.value === "pixel_9_pro") ??
    profiles.find((profile) => profile.value.startsWith("pixel")) ??
    profiles[0];
  if (!pixel) {
    throw new Error("GIF catalog has no phone profile for the SDK being installed.");
  }

  frames.push(...typeCommandFrames(TITLE_IOS, "emulatorsh", DELAY_SCALE));

  const iosRuntime = createDemoRuntime({
    catalog,
    windowTitle,
    keyQueue: [
      keysToSelect(platforms, (item) => item.value === "ios", "iOS"),
      keysToSelect(catalog.ios, (item) => item.value === iosDevice.value, iosDevice.name),
    ],
    frames,
  });
  await main(iosRuntime);

  windowTitle.current = TITLE_ANDROID;
  frames.push(...typeCommandFrames(TITLE_ANDROID, "emulatorsh", DELAY_SCALE));

  const androidRuntime = createDemoRuntime({
    catalog,
    windowTitle,
    keyQueue: [
      keysToSelect(platforms, (item) => item.value === "android", "Android"),
      keysToSelect(catalog.android, (item) => Boolean(item.create) || item.value === CREATE_VALUE, "Create new device"),
      keysToSelect(formFactors, (item) => item.value === "phone", "Mobile Phone"),
      keysToSelect(
        [...catalog.installed.phone, installSdkOption()],
        (item) => item.value === INSTALL_SDK_VALUE,
        "Install new SDK",
      ),
      keysToSelect(
        catalog.available.phone,
        (item) => item.package === toInstall.package,
        toInstall.name,
      ),
      keysToSelect(profiles, (item) => item.value === pixel.value, pixel.name),
    ] as ScriptedKey[][],
    frames,
  });
  await main(androidRuntime);

  fs.mkdirSync(path.dirname(outGif), { recursive: true });
  fs.writeFileSync(outGif, await encodeGif(frames));
  console.log(`Wrote ${frames.length} frames to ${outGif}`);
}

void record();
