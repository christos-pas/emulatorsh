import { layoutForSelection } from "../cli/ui/prompt";
import { BLUE, GRAY, GREEN, ORANGE, PURPLE, RESET, TEAL } from "../cli/constants";
import type { MenuItem } from "../cli/types";
import type { DemoFrame } from "./runtime";

const BG = "#1e1e2e";
const BAR = "#11111b";
const TEXT = "#cdd6f4";
const MUTED = "#a6adc8";
const DIM = "#6c7086";
const HIGHLIGHT = "#313244";
const TEAL_HEX = "#00d7d7";
const FONT = "Menlo, JetBrains Mono, Monaco, monospace";
const CHAR_W = 8;
const FONT_SIZE = 13;
const TEXT_X = 24;

const ANSI_COLORS: Record<string, string> = {
  [GREEN]: "#a6e3a1",
  [TEAL]: TEAL_HEX,
  [BLUE]: "#4ea8ff",
  [PURPLE]: "#cba6f7",
  [ORANGE]: "#ff8700",
  [GRAY]: DIM,
};

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function text(
  x: number,
  y: number,
  fill: string,
  value: string,
  size = FONT_SIZE,
  extra = "",
): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-family="${FONT}, Menlo, Monaco, monospace"${extra} xml:space="preserve">${xml(value)}</text>`;
}

function chrome(windowTitle: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="760" height="360" viewBox="0 0 760 360">
  <rect width="760" height="360" rx="12" fill="${BG}"/>
  <path d="M0 12 Q0 0 12 0 H748 Q760 0 760 12 V40 H0 Z" fill="${BAR}"/>
  <circle cx="22" cy="20" r="6" fill="#ff5f56"/>
  <circle cx="42" cy="20" r="6" fill="#ffbd2e"/>
  <circle cx="62" cy="20" r="6" fill="#27c93f"/>
  ${text(380, 25, DIM, windowTitle, 12, ' text-anchor="middle"')}
  ${body}
</svg>`;
}

function parseAnsi(line: string, startFill = TEXT): { text: string; fill: string }[] {
  const parts: { text: string; fill: string }[] = [];
  let fill = startFill;
  const re = /\x1b\[[0-9;]*m/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    if (match.index > last) {
      parts.push({ text: line.slice(last, match.index), fill });
    }
    const code = match[0];
    if (code === RESET) {
      fill = TEXT;
    } else if (ANSI_COLORS[code]) {
      fill = ANSI_COLORS[code];
    }
    last = match.index + code.length;
  }
  if (last < line.length) {
    parts.push({ text: line.slice(last), fill });
  }
  return parts.filter((part) => part.text.length > 0);
}

function coloredLine(x: number, y: number, line: string, startFill = TEXT): string {
  const spans = parseAnsi(line, startFill);
  let cursor = x;
  return spans
    .map((span) => {
      const node = text(cursor, y, span.fill, span.text);
      cursor += span.text.length * CHAR_W;
      return node;
    })
    .join("\n  ");
}

function highlightFor(items: MenuItem[], selected: number): string {
  const layout = layoutForSelection(items, selected);
  const local = selected - layout.start;
  const row = layout.twoCols
    ? local < layout.leftCount
      ? local
      : local - layout.leftCount
    : local;
  const y = 92 + row * 24 - 17;
  if (!layout.twoCols) {
    return `<rect x="12" y="${y}" width="736" height="24" rx="4" fill="${HIGHLIGHT}"/>`;
  }
  const inLeft = local < layout.leftCount;
  const colPx = layout.colWidth * CHAR_W;
  const x = inLeft ? 12 : TEXT_X + colPx - 12;
  return `<rect x="${x}" y="${y}" width="${colPx + 12}" height="24" rx="4" fill="${HIGHLIGHT}"/>`;
}

export function frameToSvg(frame: DemoFrame): string {
  if (frame.kind === "output") {
    const parts = frame.lines.map((line, index) => {
      const y = 72 + index * 22;
      const node = text(TEXT_X, y, line.fill ?? TEXT, line.text);
      if (frame.caret && index === frame.lines.length - 1) {
        return `${node}\n  <rect x="${TEXT_X + line.text.length * CHAR_W}" y="${y - 13}" width="7" height="15" fill="${TEXT}"/>`;
      }
      return node;
    });
    return chrome(frame.windowTitle, parts.join("\n  "));
  }

  const parts = [
    coloredLine(TEXT_X, 64, frame.heading, MUTED),
    highlightFor(frame.items, frame.selected),
    ...frame.lines.map((line, index) => coloredLine(TEXT_X, 92 + index * 24, line)),
  ];
  return chrome(frame.windowTitle, parts.join("\n  "));
}

export function typeCommandFrames(
  windowTitle: string,
  command: string,
  delayScale: number,
): DemoFrame[] {
  const frames: DemoFrame[] = [
    {
      kind: "output",
      windowTitle,
      lines: [{ text: "$ " }],
      caret: true,
      delay: 0.35 * delayScale,
    },
  ];
  let typed = "";
  for (const char of command) {
    typed += char;
    frames.push({
      kind: "output",
      windowTitle,
      lines: [{ text: `$ ${typed}` }],
      caret: true,
      delay: 0.08 * delayScale,
    });
  }
  frames.push({
    kind: "output",
    windowTitle,
    lines: [{ text: `$ ${command}` }],
    caret: false,
    delay: 0.18 * delayScale,
  });
  return frames;
}

export { FONT };
