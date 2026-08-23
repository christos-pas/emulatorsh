import { ORANGE, RESET, SIMULATE_INSTALL_NOTE } from "../constants";

const BAR_WIDTH = 38;
const TOTAL_MB = 362;
const DOWNLOAD_TICKS = [6, 14, 23, 35, 47, 58, 71, 83, 92, 100];
const TICK_MS = 90;

export function sdkProgressBar(percent: number, width = BAR_WIDTH): string {
  const clamped = Math.min(100, Math.max(0, percent));
  const filled = Math.round((width * clamped) / 100);
  return `[${"=".repeat(filled)}${" ".repeat(width - filled)}] ${String(clamped).padStart(3)}%`;
}

export function sdkDownloadLine(percent: number, totalMb = TOTAL_MB): string {
  const mb = Math.round((totalMb * Math.min(100, Math.max(0, percent))) / 100);
  return `${sdkProgressBar(percent)}   ${mb} MB / ${totalMb} MB`;
}

export function withSimulateInstallNote(line: string): string {
  return `${line} ${SIMULATE_INSTALL_NOTE}`;
}

function writeOrange(line: string, newline = true): void {
  process.stdout.write(`${ORANGE}${withSimulateInstallNote(line)}${RESET}${newline ? "\n" : ""}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function playSimulateSdkInstall(pkg: string): Promise<void> {
  writeOrange("Do you accept the license 'android-sdk-license' [y/n]: y");
  await sleep(TICK_MS);
  writeOrange(`Downloading ${pkg}`);
  for (const percent of DOWNLOAD_TICKS) {
    process.stdout.write(`\r${ORANGE}${withSimulateInstallNote(sdkDownloadLine(percent))}${RESET}`);
    await sleep(TICK_MS);
  }
  process.stdout.write("\n");
  writeOrange("Unzipping...");
  for (const percent of [42, 100]) {
    process.stdout.write(`\r${ORANGE}${withSimulateInstallNote(sdkProgressBar(percent))}${RESET}`);
    await sleep(TICK_MS);
  }
  process.stdout.write("\n");
}
