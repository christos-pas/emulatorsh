import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  chromeAppArgs,
  closeFakeEmulator,
  isFakeEmulatorCommand,
  fakeEmulatorHtml,
  fakeEmulatorKind,
  fakeEmulatorSize,
  fakeEmulatorSvg,
  writeLinuxWindowScript,
  writeMacWindowScript,
  writeWindowsWindowScript,
  type FakeKind,
} from "./fake-window.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "emulatorsh-test-"));
  dirs.push(dir);
  return dir;
}

function svgSize(kind: FakeKind, svg: string): { w: string; h: string } {
  const match = svg.match(/width="(\d+)" height="(\d+)"/);
  assert.ok(match?.[1] && match[2], `missing width/height on ${kind} svg`);
  return { w: match[1], h: match[2] };
}

test("fake emulator SVGs are the frame size and say FAKE EMULATOR", () => {
  for (const kind of ["android", "ios", "wear"] as const) {
    const { w, h } = fakeEmulatorSize(kind);
    const svg = fakeEmulatorSvg(kind, "Pixel_9_API_36");
    const size = svgSize(kind, svg);
    assert.equal(size.w, String(w));
    assert.equal(size.h, String(h));
    assert.match(svg, /FAKE EMULATOR|FAKE[\s\S]*EMULATOR/);
    assert.match(svg, /Pixel_9_API_36/);
    assert.match(svg, /#ff8700/);
  }
});

test("fake emulator HTML is sized to the SVG and escapes the title", () => {
  const svg = fakeEmulatorSvg("ios", "iPhone 16");
  const html = fakeEmulatorHtml("ios", 'iPhone 16 <Pro>', svg);
  const { w, h } = fakeEmulatorSize("ios");
  assert.match(html, new RegExp(`width: ${w}px`));
  assert.match(html, new RegExp(`height: ${h}px`));
  assert.match(html, /iPhone 16 &lt;Pro&gt;/);
  assert.doesNotMatch(html, /iPhone 16 <Pro>/);
  assert.match(html, /FAKE EMULATOR/);
});

test("wear vs android kind comes from the name or system image", () => {
  assert.equal(fakeEmulatorKind("Pixel_9_API_36"), "android");
  assert.equal(fakeEmulatorKind("Wear_OS_Large_Round_API_36"), "wear");
  assert.equal(
    fakeEmulatorKind("Watch", { sysdir: "system-images/android-36/android-wear/arm64-v8a" }),
    "wear",
  );
  assert.equal(fakeEmulatorKind("Copy", { deviceName: "wearos_large_round" }), "wear");
});

test("Chrome app args pin the window to the SVG size", () => {
  const args = chromeAppArgs("file:///tmp/x.html", "/tmp/profile", 260, 540);
  assert.equal(args.includes("--window-size=260,540"), true);
  assert.ok(args.some((arg) => arg.startsWith("--user-data-dir=")));
  assert.ok(args.some((arg) => arg.startsWith("--app=")));
});

test("native window scripts use the SVG width and height", () => {
  const dir = tmp();
  const html = path.join(dir, "device.html");
  fs.writeFileSync(html, "<html></html>");
  const mac = fs.readFileSync(writeMacWindowScript(dir, html, "Pixel 9", 260, 540), "utf8");
  assert.match(mac, /const width = 260;/);
  assert.match(mac, /const height = 540;/);
  assert.match(mac, /setContentSize\(\$\.NSMakeSize\(width, height\)\)/);

  const win = fs.readFileSync(writeWindowsWindowScript(dir), "utf8");
  assert.match(win, /ClientSize = New-Object System\.Drawing\.Size\(\$Width, \$Height\)/);
  assert.match(win, /FormBorderStyle]::FixedSingle/);

  const linux = fs.readFileSync(writeLinuxWindowScript(dir), "utf8");
  assert.match(linux, /set_default_size\(width, height\)/);
  assert.match(linux, /set_size_request\(width, height\)/);
});

test("closing an unknown fake window is a no-op", () => {
  assert.equal(closeFakeEmulator("missing-device"), false);
});

test("a reused PID is not killed unless it is still our fake emulator", () => {
  const dir = "/var/folders/xx/emulatorsh-fake-abc123";
  assert.equal(isFakeEmulatorCommand(`osascript -l JavaScript ${dir}/window.js`, dir), true);
  assert.equal(isFakeEmulatorCommand("/Applications/Safari.app/Contents/MacOS/Safari", dir), false);
  assert.equal(
    isFakeEmulatorCommand("osascript -l JavaScript /tmp/emulatorsh-fake-other/window.js", dir),
    false,
  );
  assert.equal(isFakeEmulatorCommand(""), false);
});
