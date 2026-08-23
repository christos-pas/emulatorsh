import { BLUE, RESET } from "../../sdk/constants";
import { sdkProgressBar } from "./install-progress";

export const SUSPEND_BAR_WIDTH = 20;
export const SUSPEND_DURATION_MS = 3000;
export const SUSPEND_TICKS = 15;

export function suspendHeading(name: string): string {
  return `Suspending ${name}...`;
}

export function suspendProgressBar(percent: number): string {
  return sdkProgressBar(percent, SUSPEND_BAR_WIDTH);
}

export async function playSuspendProgress(
  name: string,
  options: {
    write?: (text: string) => void;
    durationMs?: number;
    onStart?: () => void | Promise<void>;
  } = {},
): Promise<void> {
  const write = options.write ?? ((text) => process.stdout.write(text));
  const duration = options.durationMs ?? SUSPEND_DURATION_MS;
  write(`${BLUE}${suspendHeading(name)}${RESET}\n`);
  await options.onStart?.();
  const ticks = Math.max(1, SUSPEND_TICKS);
  const step = duration / ticks;
  for (let i = 1; i <= ticks; i += 1) {
    const percent = Math.round((i / ticks) * 100);
    write(`\r${BLUE}${suspendProgressBar(percent)}${RESET}`);
    if (step > 0) {
      await sleep(step);
    }
  }
  write("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
