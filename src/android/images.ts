import path from "node:path";

import { INSTALL_SDK_VALUE, MAX_AVAILABLE_SDKS, NON_PHONE_IMAGE, WEAR_IMAGE } from "../constants.js";
import type { ExecOutputError, FormFactor, MenuItem, SystemImage } from "../types.js";
import { runFile, spawnProcess } from "../host/exec.js";
import { existsSync, readdirSync, statSync } from "../host/fs.js";
import { imageDisplayName } from "./format.js";
import {
  apiSortKey,
  hostAbi,
  resolveSdkRoot,
  resolveSdkmanager,
} from "./sdk.js";

export { imageDisplayName };

export function isPhoneSystemImage(tag: string): boolean {
  return !NON_PHONE_IMAGE.test(tag);
}

export function isWearSystemImage(tag: string): boolean {
  return WEAR_IMAGE.test(tag) && !/-cn$/i.test(tag);
}

export function matchesFormFactor(tag: string, formFactor: FormFactor): boolean {
  return formFactor === "wear" ? isWearSystemImage(tag) : isPhoneSystemImage(tag);
}

export function installSdkOption(): MenuItem {
  return {
    name: "Install new SDK",
    value: INSTALL_SDK_VALUE,
    installSdk: true,
    accent: "purple",
  };
}

export function listInstalledSystemImages(formFactor: FormFactor): SystemImage[] {
  const sdkRoot = resolveSdkRoot();
  if (!sdkRoot) {
    return [];
  }
  const imagesRoot = path.join(sdkRoot, "system-images");
  if (!existsSync(imagesRoot)) {
    return [];
  }

  const images: SystemImage[] = [];
  for (const apiDir of readdirSync(imagesRoot)) {
    const apiPath = path.join(imagesRoot, apiDir);
    if (!statSync(apiPath).isDirectory() || !apiDir.startsWith("android-")) {
      continue;
    }
    const api = apiDir.slice("android-".length);
    for (const tag of readdirSync(apiPath)) {
      const tagPath = path.join(apiPath, tag);
      if (!statSync(tagPath).isDirectory()) {
        continue;
      }
      if (!matchesFormFactor(tag, formFactor)) {
        continue;
      }
      for (const abi of readdirSync(tagPath)) {
        const abiPath = path.join(tagPath, abi);
        if (!statSync(abiPath).isDirectory()) {
          continue;
        }
        const pkg = `system-images;${apiDir};${tag};${abi}`;
        images.push({
          name: imageDisplayName(api, tag, abi),
          value: pkg,
          package: pkg,
          api,
          sysdir: `system-images/${apiDir}/${tag}/${abi}`,
        });
      }
    }
  }

  return images.sort((a, b) => {
    const apiDiff = Number(b.api) - Number(a.api);
    if (apiDiff !== 0) {
      return apiDiff;
    }
    return a.name.localeCompare(b.name);
  });
}

export function parseSdkmanagerSystemImages(
  output: string,
  formFactor: FormFactor,
  limit = MAX_AVAILABLE_SDKS,
): SystemImage[] {
  const abi = hostAbi();
  const packages: SystemImage[] = [];
  const seen = new Set<string>();
  const pattern =
    /system-images(?:\/|;)(android-[A-Za-z0-9._-]+)(?:\/|;)([^/\s;|]+)(?:\/|;)([^/\s;|]+)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(output)) !== null) {
    const apiDir = match[1];
    const tag = match[2];
    const imageAbi = match[3];
    if (!apiDir || !tag || !imageAbi) {
      continue;
    }
    if (imageAbi !== abi || !matchesFormFactor(tag, formFactor)) {
      continue;
    }
    const pkg = `system-images;${apiDir};${tag};${imageAbi}`;
    if (seen.has(pkg)) {
      continue;
    }
    seen.add(pkg);
    const api = apiDir.slice("android-".length);
    packages.push({
      name: imageDisplayName(api, tag, imageAbi),
      value: pkg,
      package: pkg,
      api,
    });
  }

  return packages
    .sort((a, b) => {
      const apiDiff = apiSortKey(b.api) - apiSortKey(a.api);
      if (apiDiff !== 0) {
        return apiDiff;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function listAvailableSystemImages(formFactor: FormFactor): SystemImage[] {
  const sdkmanager = resolveSdkmanager();
  const sdkRoot = resolveSdkRoot();
  if (!sdkmanager || !sdkRoot) {
    return [];
  }

  let output: string;
  try {
    output = runFile(sdkmanager, ["--list", `--sdk_root=${sdkRoot}`], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    const execError = error as ExecOutputError;
    output = `${execError.stdout || ""}\n${execError.stderr || ""}`;
  }

  const installed = new Set(
    listInstalledSystemImages(formFactor).map((image) => image.package),
  );
  return parseSdkmanagerSystemImages(output, formFactor).map((image) => ({
    ...image,
    installed: installed.has(image.package),
  }));
}

export function installSystemImage(pkg: string): Promise<void> {
  const sdkmanager = resolveSdkmanager();
  const sdkRoot = resolveSdkRoot();
  if (!sdkmanager || !sdkRoot) {
    return Promise.reject(
      new Error("Could not find sdkmanager. Install Android SDK Command-line Tools."),
    );
  }

  return new Promise((resolve, reject) => {
    const args = [`--sdk_root=${sdkRoot}`, pkg];
    const child = spawnProcess(sdkmanager, args, {
      stdio: ["pipe", "inherit", "inherit"],
    });
    const ignorePipeErrors = (stream: NodeJS.WritableStream) => {
      stream.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code !== "EPIPE") {
          reject(error);
        }
      });
    };
    if (child.stdin) {
      ignorePipeErrors(child.stdin);

      // Finite answers, then close stdin. An infinite `yes` pipe throws EPIPE
      // when sdkmanager finishes and closes the handle (download can still succeed).
      child.stdin.write("y\n".repeat(50));
      child.stdin.end();
    }

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`sdkmanager exited with code ${code}`));
    });
  });
}
