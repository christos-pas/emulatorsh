import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { existingAvds, listAndroidAvds, runningAndroidAvdNames } from "../sdk/android/avds";
import { specSupportedByDevice, loadDeviceSoftware } from "../sdk/android/device-xml";
import {
  listInstalledSystemImages,
  parseSdkmanagerSystemImages,
} from "../sdk/android/images";
import {
  isAllowedPhoneProfile,
  isAllowedWearProfile,
  parseDeviceDefinitions,
} from "../sdk/android/profiles";
import { resolveAvdmanager, resolveSdkRoot, resolveSdkmanager } from "../sdk/android/sdk";
import {
  specFromImage,
  specFromSysdir,
  specKey,
  uniqueSpecs,
  type ImageSpec,
} from "../sdk/android/specs";
import { listIosSimulators, listWatchSimulators } from "../sdk/apple/simulators";
import type { AppleDevice, ExecOutputError, FormFactor } from "../sdk/types";
import { runFile } from "../system/exec";
import { createHostSystem } from "../system/host";
import type { DemoAvd, DemoIosDevice, DemoProfile, DemoWorld } from "./data";

const system = createHostSystem();

const BEGIN = "// <demo-fixture>";
const END = "// </demo-fixture>";
const ALL_AVAILABLE = 10_000;

const here = path.dirname(fileURLToPath(import.meta.url));

function repoRootFrom(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.resolve(dir, "..");
  }
  throw new Error("Could not find repo root (package.json).");
}

function sdkmanagerOutput(): string {
  const sdkmanager = resolveSdkmanager(system);
  const sdkRoot = resolveSdkRoot(system);
  if (!sdkmanager || !sdkRoot) {
    throw new Error("Could not find sdkmanager. Install Android SDK Command-line Tools.");
  }
  try {
    return runFile(system, sdkmanager, ["--list", `--sdk_root=${sdkRoot}`], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    const execError = error as ExecOutputError;
    return `${execError.stdout || ""}\n${execError.stderr || ""}`;
  }
}

function availableSpecs(output: string, formFactor: FormFactor): ImageSpec[] {
  return uniqueSpecs(
    parseSdkmanagerSystemImages(output, formFactor, ALL_AVAILABLE)
      .map((image) => specFromImage(image))
      .filter((spec): spec is ImageSpec => Boolean(spec)),
  );
}

function installedSpecs(): ImageSpec[] {
  const fromDisk: ImageSpec[] = [];
  for (const formFactor of ["phone", "wear"] as const satisfies FormFactor[]) {
    for (const image of listInstalledSystemImages(system, formFactor)) {
      const spec = specFromImage(image);
      if (spec) {
        fromDisk.push(spec);
      }
    }
  }
  return uniqueSpecs(fromDisk);
}

function snapshotApple(items: AppleDevice[], fallbackOs: "iOS" | "watchOS"): DemoIosDevice[] {
  return items.map((device) => {
    const match = device.runtime.match(/^(iOS|watchOS) (.+)$/);
    const label = match?.[1] ?? fallbackOs;
    const version = match?.[2];
    const runtime = version
      ? `${label}-${version.replaceAll(".", "-")}`
      : fallbackOs;
    return {
      name: device.name,
      value: device.id,
      runtime,
    };
  });
}

function snapshotAvds(): DemoAvd[] {
  const running = runningAndroidAvdNames(system);
  const details = new Map(existingAvds(system).map((avd) => [avd.name, avd]));
  return listAndroidAvds(system).map((item) => {
      const detail = details.get(item.name);
      return {
        name: item.name,
        deviceName: detail?.deviceName ?? "",
        sysdir: detail?.sysdir ?? "",
        running: running.has(item.name) || Boolean(item.running),
      };
    });
}

function snapshotProfiles(
  formFactor: FormFactor,
  images: ImageSpec[],
  definitions: ReturnType<typeof parseDeviceDefinitions>,
  software: ReturnType<typeof loadDeviceSoftware>,
): DemoProfile[] {
  const allow = formFactor === "wear" ? isAllowedWearProfile : isAllowedPhoneProfile;
  return definitions
    .filter(allow)
    .map((device) => {
      const meta = software.get(device.id);
      const supportedSdks = meta
        ? images.filter((spec) => specSupportedByDevice(spec.api, spec.tag, meta))
        : images;
      return {
        name: device.name,
        value: device.id,
        supportedSdks,
      };
    })
    .filter((profile) => profile.supportedSdks.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function formatSpec(spec: ImageSpec): string {
  return `{ api: ${JSON.stringify(spec.api)}, tag: ${JSON.stringify(spec.tag)} }`;
}

function formatSpecs(specs: ImageSpec[], indent: string): string {
  if (specs.length === 0) {
    return "[]";
  }
  return `[\n${specs.map((spec) => `${indent}${formatSpec(spec)},`).join("\n")}\n${indent.slice(2)}]`;
}

function specsExpr(specs: ImageSpec[], all: ImageSpec[], constName: string): string {
  if (specs.length === all.length && specs.every((spec, i) => specKey(spec) === specKey(all[i] ?? spec))) {
    return constName;
  }
  const allKeys = new Set(all.map(specKey));
  const specKeys = new Set(specs.map(specKey));
  if (specs.length === all.length && [...specKeys].every((key) => allKeys.has(key))) {
    return constName;
  }
  return formatSpecs(specs, "        ");
}

function formatAvd(avd: DemoAvd): string {
  return `    {
      name: ${JSON.stringify(avd.name)},
      deviceName: ${JSON.stringify(avd.deviceName)},
      sysdir: ${JSON.stringify(avd.sysdir)},
      running: ${avd.running},
    }`;
}

function formatIos(device: DemoIosDevice): string {
  return `    { name: ${JSON.stringify(device.name)}, value: ${JSON.stringify(device.value)}, runtime: ${JSON.stringify(device.runtime)} }`;
}

function formatProfile(profile: DemoProfile, constName: string, all: ImageSpec[]): string {
  return `      { name: ${JSON.stringify(profile.name)}, value: ${JSON.stringify(profile.value)}, supportedSdks: ${specsExpr(profile.supportedSdks, all, constName)} }`;
}

function renderFixture(world: DemoWorld): string {
  return `${BEGIN}
const PHONE_IMAGE_SPECS: DemoImageSpec[] = ${formatSpecs(world.phoneImages, "  ")};

const WEAR_IMAGE_SPECS: DemoImageSpec[] = ${formatSpecs(world.wearImages, "  ")};

/** Fixture devices, images, and profiles shared by --simulate and GIF recording. */
export const DEMO: DemoWorld = {
  ios: [
${world.ios.map(formatIos).join(",\n")},
  ],
  watchos: [
${world.watchos.map(formatIos).join(",\n")},
  ],
  androidAvds: [
${world.androidAvds.map(formatAvd).join(",\n")},
  ],
  phoneImages: PHONE_IMAGE_SPECS,
  wearImages: WEAR_IMAGE_SPECS,
  installedImages: ${formatSpecs(world.installedImages, "    ")},
  profiles: {
    phone: [
${world.profiles.phone.map((profile) => formatProfile(profile, "PHONE_IMAGE_SPECS", world.phoneImages)).join(",\n")},
    ],
    wear: [
${world.profiles.wear.map((profile) => formatProfile(profile, "WEAR_IMAGE_SPECS", world.wearImages)).join(",\n")},
    ],
  },
};
${END}`;
}

function replaceFixture(source: string, fixture: string): string {
  const start = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not find ${BEGIN} ... ${END} markers in data.ts`);
  }
  return `${source.slice(0, start)}${fixture}${source.slice(end + END.length)}`;
}

function collectWorld(): DemoWorld {
  const avdmanager = resolveAvdmanager(system);
  if (!avdmanager) {
    throw new Error("Could not find avdmanager. Install Android SDK Command-line Tools.");
  }
  const listOutput = runFile(system, avdmanager, ["list", "device"], { encoding: "utf8" });
  const definitions = parseDeviceDefinitions(listOutput);
  const sdkOutput = sdkmanagerOutput();
  const phoneImages = availableSpecs(sdkOutput, "phone");
  const wearImages = availableSpecs(sdkOutput, "wear");
  if (phoneImages.length === 0 && wearImages.length === 0) {
    throw new Error("sdkmanager --list returned no system images for this host ABI.");
  }
  const androidAvds = snapshotAvds();
  const installedImages = uniqueSpecs([
    ...installedSpecs(),
    ...androidAvds.map((avd) => specFromSysdir(avd.sysdir)).filter((spec): spec is ImageSpec => Boolean(spec)),
  ]);
  const software = loadDeviceSoftware(system);
  if (software.size === 0) {
    console.warn(
      "Could not read device definitions from the SDK (sdklib devices XML). Each profile will list every SDK for its form factor.",
    );
  }
  return {
    ios: snapshotApple(listIosSimulators(system), "iOS"),
    watchos: snapshotApple(listWatchSimulators(system), "watchOS"),
    androidAvds,
    phoneImages,
    wearImages,
    installedImages,
    profiles: {
      phone: snapshotProfiles("phone", phoneImages, definitions, software),
      wear: snapshotProfiles("wear", wearImages, definitions, software),
    },
  };
}

function main(): void {
  const dryRun = process.argv.includes("--dry-run");
  const repoRoot = repoRootFrom(here);
  const dataPath = path.join(repoRoot, "src", "simulate", "data.ts");
  const world = collectWorld();
  const summary = `iOS ${world.ios.length}, watchOS ${world.watchos.length}, Android AVDs ${world.androidAvds.length}, phone SDKs ${world.phoneImages.length}, wear SDKs ${world.wearImages.length}, phone devices ${world.profiles.phone.length}, wear devices ${world.profiles.wear.length}, installed SDKs ${world.installedImages.length}`;
  if (dryRun) {
    const phoneCounts = world.profiles.phone.map((profile) => profile.supportedSdks.length);
    const wearCounts = world.profiles.wear.map((profile) => profile.supportedSdks.length);
    console.log(`Dry run (not writing ${dataPath})\n  ${summary}`);
    if (phoneCounts.length > 0) {
      console.log(
        `  phone profile SDK counts: min ${Math.min(...phoneCounts)}, max ${Math.max(...phoneCounts)}`,
      );
    }
    if (wearCounts.length > 0) {
      console.log(
        `  wear profile SDK counts: min ${Math.min(...wearCounts)}, max ${Math.max(...wearCounts)}`,
      );
    }
    return;
  }
  const source = fs.readFileSync(dataPath, "utf8");
  fs.writeFileSync(dataPath, replaceFixture(source, renderFixture(world)));
  console.log(`Updated ${dataPath}\n  ${summary}`);
}

main();
