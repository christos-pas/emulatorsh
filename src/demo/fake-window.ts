import { execFileSync, spawn, type SpawnOptions } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { isWearSpec, specFromSysdir } from "../android/specs.js";
import { rememberStoredFakeWindow, takeStoredFakeWindows } from "./store.js";

export type FakeKind = "android" | "ios" | "wear";

const ORANGE = "#ff8700";
const MUTED = "#a6adc8";
const DIM = "#6c7086";

export const FAKE_EMULATOR_FRAME: Record<FakeKind, { w: number; h: number }> = {
  android: { w: 260, h: 540 },
  ios: { w: 260, h: 560 },
  wear: { w: 340, h: 300 },
};

const FRAME = FAKE_EMULATOR_FRAME;

export function fakeEmulatorKind(
  name: string,
  meta?: { sysdir?: string; deviceName?: string },
): Exclude<FakeKind, "ios"> {
  const spec = meta?.sysdir ? specFromSysdir(meta.sysdir) : null;
  if (
    (spec && isWearSpec(spec)) ||
    /wear/i.test(`${name} ${meta?.deviceName ?? ""} ${meta?.sysdir ?? ""}`)
  ) {
    return "wear";
  }
  return "android";
}

export function fakeEmulatorSize(kind: FakeKind): { w: number; h: number } {
  return FRAME[kind];
}

const FAKE_DIR_MARK = "emulatorsh-fake-";

type TrackedWindow = { pid: number; dir?: string };

const fakeWindows = new Map<string, TrackedWindow[]>();

export function openFakeEmulator(kind: FakeKind, title: string, deviceId = title): void {
  try {
    const label = title.trim() || "emulator";
    const svg = fakeEmulatorSvg(kind, label);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "emulatorsh-fake-"));
    const slug = fileSlug(label);
    const svgPath = path.join(dir, `${slug}.svg`);
    const htmlPath = path.join(dir, `${slug}.html`);
    fs.writeFileSync(svgPath, svg);
    fs.writeFileSync(htmlPath, fakeEmulatorHtml(kind, label, svg));
    const pid = showWindow(kind, dir, htmlPath, svgPath, label);
    rememberFakeWindow(deviceId, pid, dir);
  } catch {
    // Best-effort chrome. Simulate still "starts" if a window cannot open.
  }
}

export function isFakeEmulatorCommand(command: string, dir?: string): boolean {
  if (!command.includes(FAKE_DIR_MARK)) {
    return false;
  }
  return !dir || command.includes(dir);
}

export function closeFakeEmulator(deviceId: string): boolean {
  const stored = takeStoredFakeWindows(deviceId);
  const tracked = [...(fakeWindows.get(deviceId) ?? []), ...stored];
  const dirs = [...new Set(tracked.map((row) => row.dir).filter((dir): dir is string => Boolean(dir)))];
  const candidates = new Map<number, string | undefined>();
  for (const row of tracked) {
    candidates.set(row.pid, row.dir ?? candidates.get(row.pid));
  }
  for (const dir of dirs) {
    for (const pid of pidsUsingPath(dir)) {
      candidates.set(pid, dir);
    }
  }

  let closed = false;
  for (const [pid, dir] of candidates) {
    if (killFakeWindowPid(pid, dir)) {
      closed = true;
    }
  }
  fakeWindows.delete(deviceId);
  return closed;
}

function rememberFakeWindow(deviceId: string, pid?: number, dir?: string): void {
  if (!pid) {
    return;
  }
  const windows = fakeWindows.get(deviceId) ?? [];
  windows.push({ pid, dir });
  fakeWindows.set(deviceId, windows);
  rememberStoredFakeWindow(deviceId, pid, dir);
}

function pidsUsingPath(dir: string): number[] {
  try {
    const output = execFileSync("ps", ["-Ao", "pid=,command="], { encoding: "utf8" });
    const pids: number[] = [];
    for (const line of output.split(/\r?\n/)) {
      if (!isFakeEmulatorCommand(line, dir)) {
        continue;
      }
      const pid = Number(line.trim().split(/\s+/)[0]);
      if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
        pids.push(pid);
      }
    }
    return pids;
  } catch {
    return [];
  }
}

function processCommand(pid: number): string | undefined {
  try {
    const output = execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
    }).trim();
    return output || undefined;
  } catch {
    return undefined;
  }
}

function killFakeWindowPid(pid: number, dir?: string): boolean {
  const command = processCommand(pid);
  if (!command || !isFakeEmulatorCommand(command, dir)) {
    return false;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return false;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // already exiting after SIGTERM
  }
  return true;
}

export function fakeEmulatorSvg(kind: FakeKind, title: string): string {
  if (kind === "wear") {
    return wearSvg(title);
  }
  if (kind === "ios") {
    return iphoneSvg(title);
  }
  return androidSvg(title);
}

export function fakeEmulatorHtml(kind: FakeKind, title: string, svg: string): string {
  const { w, h } = FRAME[kind];
  const inline = svg.replace(/^<\?xml[^>]*>\s*/u, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)} — FAKE EMULATOR</title>
  <style>
    html, body {
      margin: 0;
      width: ${w}px;
      height: ${h}px;
      background: #11111b;
      overflow: hidden;
      user-select: none;
      cursor: default;
    }
    svg { display: block; width: ${w}px; height: ${h}px; }
  </style>
</head>
<body>
${inline}
</body>
</html>
`;
}

function showWindow(
  kind: FakeKind,
  dir: string,
  htmlPath: string,
  svgPath: string,
  title: string,
): number | undefined {
  const { w, h } = FRAME[kind];
  const fileUrl = pathToFileURL(htmlPath).href;
  if (process.platform === "darwin") {
    return detach("osascript", ["-l", "JavaScript", writeMacWindowScript(dir, htmlPath, title, w, h)]);
  }
  if (process.platform === "win32") {
    return detach(
      "powershell.exe",
      [
        "-NoProfile",
        "-STA",
        "-WindowStyle",
        "Hidden",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        writeWindowsWindowScript(dir),
        "-HtmlPath",
        htmlPath,
        "-Title",
        title,
        "-Width",
        String(w),
        "-Height",
        String(h),
      ],
      { windowsHide: true },
    );
  }
  const python = linuxPython();
  if (python && linuxHasGtkWebKit(python)) {
    return detach(python, [writeLinuxWindowScript(dir), htmlPath, title, String(w), String(h)]);
  }
  const chrome = chromeBinary();
  if (chrome) {
    return detach(chrome, chromeAppArgs(fileUrl, path.join(dir, "chrome"), w, h));
  }
  return detach("xdg-open", [svgPath]);
}

export function chromeAppArgs(fileUrl: string, profileDir: string, w: number, h: number): string[] {
  return [
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    `--window-size=${w},${h}`,
    "--window-position=100,80",
    `--app=${fileUrl}`,
  ];
}

export function writeMacWindowScript(
  dir: string,
  htmlPath: string,
  title: string,
  w: number,
  h: number,
): string {
  const jxaPath = path.join(dir, "window.js");
  fs.writeFileSync(
    jxaPath,
    `ObjC.import("Cocoa");
ObjC.import("WebKit");

ObjC.registerSubclass({
  name: "EmulatorshFakeDelegate",
  methods: {
    "applicationShouldTerminateAfterLastWindowClosed:": {
      types: ["BOOL", ["id"]],
      implementation: function () {
        return true;
      }
    }
  }
});

const width = ${w};
const height = ${h};
const app = $.NSApplication.sharedApplication;
app.setActivationPolicy($.NSApplicationActivationPolicyRegular);
app.delegate = $.EmulatorshFakeDelegate.alloc.init;

const webView = $.WKWebView.alloc.initWithFrame($.NSMakeRect(0, 0, width, height));
const url = $.NSURL.fileURLWithPath(${JSON.stringify(htmlPath)});
const access = $.NSURL.fileURLWithPath(${JSON.stringify(dir)});
webView.loadFileURLAllowingReadAccessToURL(url, access);

const style = $.NSWindowStyleMaskTitled | $.NSWindowStyleMaskClosable | $.NSWindowStyleMaskMiniaturizable;
const win = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(
  $.NSMakeRect(0, 0, width, height),
  style,
  $.NSBackingStoreBuffered,
  false
);
win.title = ${JSON.stringify(title)};
win.contentView = webView;
win.setContentSize($.NSMakeSize(width, height));
win.center;
win.makeKeyAndOrderFront(null);
app.activateIgnoringOtherApps(true);
app.run();
`,
  );
  return jxaPath;
}

export function writeWindowsWindowScript(dir: string): string {
  const ps1Path = path.join(dir, "window.ps1");
  fs.writeFileSync(
    ps1Path,
    `param(
  [Parameter(Mandatory=$true)][string]$HtmlPath,
  [Parameter(Mandatory=$true)][string]$Title,
  [Parameter(Mandatory=$true)][int]$Width,
  [Parameter(Mandatory=$true)][int]$Height
)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$form = New-Object System.Windows.Forms.Form
$form.Text = $Title
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
$form.MaximizeBox = $false
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.ClientSize = New-Object System.Drawing.Size($Width, $Height)
$form.BackColor = [System.Drawing.Color]::FromArgb(17, 17, 27)
$browser = New-Object System.Windows.Forms.WebBrowser
$browser.Dock = [System.Windows.Forms.DockStyle]::Fill
$browser.AllowWebBrowserDrop = $false
$browser.IsWebBrowserContextMenuEnabled = $false
$browser.ScriptErrorsSuppressed = $true
$browser.ScrollBarsEnabled = $false
$browser.Navigate(((New-Object System.Uri ((Resolve-Path $HtmlPath).Path)).AbsoluteUri))
$form.Controls.Add($browser)
[void]$form.ShowDialog()
`,
  );
  return ps1Path;
}

export function writeLinuxWindowScript(dir: string): string {
  const pyPath = path.join(dir, "window.py");
  fs.writeFileSync(
    pyPath,
    `import sys
import gi

gi.require_version("Gtk", "3.0")
for _ver in ("4.1", "4.0"):
    try:
        gi.require_version("WebKit2", _ver)
        break
    except ValueError:
        continue
else:
    sys.exit(1)

from gi.repository import Gtk, WebKit2
from pathlib import Path

html, title, width, height = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
win = Gtk.Window(title=title)
win.set_resizable(False)
win.set_default_size(width, height)
view = WebKit2.WebView()
view.set_size_request(width, height)
win.add(view)
view.load_uri(Path(html).resolve().as_uri())
win.connect("destroy", Gtk.main_quit)
win.show_all()
Gtk.main()
`,
  );
  return pyPath;
}

let gtkWebKit: boolean | undefined;

function linuxPython(): string | undefined {
  return ["python3", "python"].find((bin) => which(bin));
}

function linuxHasGtkWebKit(python: string): boolean {
  if (gtkWebKit !== undefined) {
    return gtkWebKit;
  }
  const probe = `import gi
gi.require_version("Gtk", "3.0")
ok = False
for v in ("4.1", "4.0"):
    try:
        gi.require_version("WebKit2", v)
        ok = True
        break
    except ValueError:
        pass
raise SystemExit(0 if ok else 1)
`;
  try {
    execFileSync(python, ["-c", probe], { stdio: "ignore", timeout: 4000 });
    gtkWebKit = true;
  } catch {
    gtkWebKit = false;
  }
  return gtkWebKit;
}

function chromeBinary(): string | undefined {
  const home = os.homedir();
  const candidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          path.join(home, "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
          "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : process.platform === "win32"
        ? [
            path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google/Chrome/Application/chrome.exe"),
            path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google/Chrome/Application/chrome.exe"),
            path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
            path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Microsoft/Edge/Application/msedge.exe"),
          ]
        : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "brave-browser", "microsoft-edge"];

  if (process.platform === "linux") {
    return candidates.find((bin) => which(bin));
  }
  return candidates.find((bin) => bin && fs.existsSync(bin));
}

function which(bin: string): boolean {
  const dirs = (process.env.PATH || "").split(path.delimiter);
  return dirs.some((dir) => fs.existsSync(path.join(dir, bin)));
}

function detach(bin: string, args: string[], extra: SpawnOptions = {}): number | undefined {
  const child = spawn(bin, args, { detached: true, stdio: "ignore", windowsHide: true, ...extra });
  child.unref();
  return child.pid ?? undefined;
}

function androidSvg(title: string): string {
  const name = fit(title, 24);
  const { w, h } = FRAME.android;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="android-screen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1b1024"/>
      <stop offset="100%" stop-color="#0b1220"/>
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="244" height="524" rx="28" fill="#2b2d31" stroke="#111318" stroke-width="3"/>
  <rect x="18" y="18" width="224" height="12" rx="3" fill="#1c1e22"/>
  <rect x="108" y="21" width="44" height="6" rx="3" fill="#111318"/>
  <rect x="22" y="38" width="216" height="430" rx="14" fill="url(#android-screen)"/>
  <circle cx="130" cy="58" r="7" fill="#111318"/>
  <circle cx="130" cy="58" r="3.2" fill="#3b82f6"/>
  <text x="36" y="80" fill="${DIM}" font-size="11" font-family="Roboto, Helvetica, sans-serif">9:41</text>
  <text x="224" y="80" fill="${DIM}" font-size="11" font-family="Roboto, Helvetica, sans-serif" text-anchor="end">LTE</text>
  ${headline(130, 248, name)}
  <rect x="22" y="468" width="216" height="46" rx="8" fill="#16181d"/>
  <polygon points="70,491 86,483 86,499" fill="${MUTED}"/>
  <circle cx="130" cy="491" r="7" fill="none" stroke="${MUTED}" stroke-width="2"/>
  <rect x="166" y="484" width="14" height="14" rx="2" fill="none" stroke="${MUTED}" stroke-width="2"/>
</svg>`;
}

function iphoneSvg(title: string): string {
  const name = fit(title, 24);
  const { w, h } = FRAME.ios;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="ios-screen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1028"/>
      <stop offset="100%" stop-color="#0c1018"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="248" height="548" rx="46" fill="#1c1c1e" stroke="#2c2c2e" stroke-width="3"/>
  <rect x="16" y="16" width="228" height="528" rx="38" fill="url(#ios-screen)"/>
  <rect x="92" y="28" width="76" height="22" rx="11" fill="#050505"/>
  <circle cx="154" cy="39" r="4" fill="#1a1a2e"/>
  <text x="36" y="78" fill="${MUTED}" font-size="12" font-family="-apple-system, SF Pro Text, Helvetica, sans-serif" font-weight="600">9:41</text>
  ${headline(130, 268, name)}
  <rect x="100" y="516" width="60" height="5" rx="2.5" fill="#c7c7cc"/>
</svg>`;
}

function wearSvg(title: string): string {
  const name = fit(title, 20);
  const { w, h } = FRAME.wear;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="wear-screen" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="#241430"/>
      <stop offset="100%" stop-color="#0b1220"/>
    </radialGradient>
  </defs>
  <rect x="118" y="8" width="64" height="28" rx="8" fill="#3f3f46"/>
  <rect x="118" y="264" width="64" height="28" rx="8" fill="#3f3f46"/>
  <circle cx="150" cy="150" r="118" fill="#2a2a2e" stroke="#52525b" stroke-width="10"/>
  <rect x="268" y="118" width="18" height="46" rx="7" fill="#a1a1aa"/>
  <rect x="266" y="176" width="12" height="22" rx="4" fill="#71717a"/>
  <circle cx="150" cy="150" r="100" fill="url(#wear-screen)"/>
  ${headline(150, 148, name, true)}
</svg>`;
}

function headline(cx: number, cy: number, name: string, compact = false): string {
  const nameY = compact ? cy + 36 : cy + 36;
  const brandY = compact ? cy + 54 : cy + 58;
  const title = compact
    ? `<text x="${cx}" y="${cy - 10}" fill="${ORANGE}" font-size="16" font-family="Menlo, ui-monospace, monospace" font-weight="700" text-anchor="middle" letter-spacing="0.18em">FAKE</text>
  <text x="${cx}" y="${cy + 12}" fill="${ORANGE}" font-size="16" font-family="Menlo, ui-monospace, monospace" font-weight="700" text-anchor="middle" letter-spacing="0.08em">EMULATOR</text>`
    : `<text x="${cx}" y="${cy}" fill="${ORANGE}" font-size="20" font-family="Menlo, ui-monospace, monospace" font-weight="700" text-anchor="middle" letter-spacing="0.12em">FAKE EMULATOR</text>`;
  return `
  ${title}
  <text x="${cx}" y="${nameY}" fill="${MUTED}" font-size="12" font-family="Menlo, ui-monospace, monospace" text-anchor="middle">${escapeXml(name)}</text>
  <text x="${cx}" y="${brandY}" fill="${DIM}" font-size="10" font-family="Menlo, ui-monospace, monospace" text-anchor="middle">emulatorsh</text>`;
}

function fileSlug(title: string): string {
  const slug = title.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return slug.slice(0, 60) || "device";
}

function fit(title: string, max: number): string {
  if (title.length <= max) {
    return title;
  }
  return `${title.slice(0, max - 1)}…`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeHtml(value: string): string {
  return escapeXml(value).replaceAll("'", "&#39;");
}
