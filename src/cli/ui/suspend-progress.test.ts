import assert from "node:assert/strict";
import { test } from "node:test";

import { BLUE, RESET } from "../constants";
import {
  playSuspendProgress,
  SUSPEND_BAR_WIDTH,
  suspendHeading,
  suspendProgressBar,
} from "./suspend-progress";

test("suspend heading names the device", () => {
  assert.equal(suspendHeading("Pixel_9_API_36"), "Suspending Pixel_9_API_36...");
});

test("suspend progress bar is short", () => {
  assert.equal(suspendProgressBar(0).length, SUSPEND_BAR_WIDTH + 7);
  assert.match(suspendProgressBar(100), /^\[={20}\] 100%$/);
});

test("suspend progress writes a blue heading and a finishing bar", async () => {
  const chunks: string[] = [];
  await playSuspendProgress("Pixel_9_API_36", {
    write: (text) => {
      chunks.push(text);
    },
    durationMs: 0,
  });
  assert.equal(chunks[0], `${BLUE}Suspending Pixel_9_API_36...${RESET}\n`);
  assert.ok(chunks.some((chunk) => chunk.includes(suspendProgressBar(100))));
  assert.equal(chunks.at(-1), "\n");
});
