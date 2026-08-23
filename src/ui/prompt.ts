import { GRAY, GREEN, PAGE_SIZE, PURPLE, RESET, TEAL } from "../constants.js";
import { canCloseItem, closeRequest, type CloseRequest } from "../devices/close.js";
import type { Direction, Layout, MenuItem } from "../types.js";

export function hideCursor(): void {
  process.stdout.write("\x1b[?25l");
}

export function showCursor(): void {
  process.stdout.write("\x1b[?25h");
}

export function restoreTerminal(): void {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  showCursor();
}

export function displayLabel(item: MenuItem): string {
  const name = item.avdName || item.name || item.label || "";
  if (item.runningSummary) {
    const { running, total } = item.runningSummary;
    const color = running > 0 ? GREEN : GRAY;
    return `${name} ${color}[running: ${running}/${total}]${RESET}`;
  }
  if (item.accent === "purple") {
    return `${PURPLE}${name}${RESET}`;
  }
  if (item.hint) {
    return `${name} ${GRAY}${item.hint}${RESET}`;
  }
  const annotation = statusAnnotation(item);
  if (!annotation) {
    return name;
  }
  return `${GREEN}${name} ${annotation}${RESET}`;
}

function statusAnnotation(item: MenuItem): string | undefined {
  if (item.installed) {
    return "[installed]";
  }
  if ((item.installedCount ?? 0) > 0) {
    return `[installed: ${item.installedCount}]`;
  }
  if (item.running) {
    return "[running]";
  }
  return undefined;
}

export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

export function fitPlain(text: string, width: number): string {
  if (text.length <= width) {
    return text;
  }
  if (width <= 1) {
    return text.slice(0, width);
  }
  return `${text.slice(0, width - 1)}…`;
}

export function cell(item: MenuItem, index: number, selected: number, width: number): string {
  const marker = index === selected ? `${TEAL}>${RESET}` : " ";
  const budget = Math.max(1, width - 4);
  const shown = formatCell(item, budget);
  const padded = `${shown}${" ".repeat(Math.max(0, budget - stripAnsi(shown).length))}`;
  return `  ${marker} ${padded}`;
}

function formatCell(item: MenuItem, budget: number): string {
  if (item.runningSummary) {
    const label = displayLabel(item);
    return stripAnsi(label).length <= budget ? label : fitPlain(stripAnsi(label), budget);
  }
  const name = item.avdName || item.name || item.label || "";
  if (item.accent === "purple") {
    return `${PURPLE}${fitPlain(name, budget)}${RESET}`;
  }
  const annotation = statusAnnotation(item);
  const extra = item.hint || annotation;
  if (!extra) {
    return fitPlain(name, budget);
  }
  const suffix = ` ${extra}`;
  const shownName = fitPlain(name, Math.max(1, budget - suffix.length));
  if (item.hint) {
    return `${shownName}${GRAY}${suffix}${RESET}`;
  }
  return `${GREEN}${shownName}${suffix}${RESET}`;
}

export function useTwoColumns(count: number): boolean {
  const terminalWidth = process.stdout.columns || 80;
  return count > 8 && terminalWidth >= 72;
}

export function pageInfo(items: MenuItem[], page: number): Layout {
  const paginate = items.length > PAGE_SIZE;
  const pages = paginate ? Math.ceil(items.length / PAGE_SIZE) : 1;
  const safePage = Math.min(Math.max(page, 0), pages - 1);
  const start = paginate ? safePage * PAGE_SIZE : 0;
  const pageItems = paginate ? items.slice(start, start + PAGE_SIZE) : items;
  const twoCols = useTwoColumns(pageItems.length);
  const leftCount = twoCols ? Math.ceil(pageItems.length / 2) : pageItems.length;
  const terminalWidth = process.stdout.columns || 80;
  return {
    paginate,
    page: safePage,
    pages,
    start,
    pageItems,
    twoCols,
    leftCount,
    rightCount: pageItems.length - leftCount,
    rowCount: leftCount,
    colWidth: twoCols ? Math.floor(terminalWidth / 2) : terminalWidth,
    drawnRows: leftCount + (paginate ? 1 : 0),
  };
}

export function layoutForSelection(items: MenuItem[], selected: number): Layout {
  const paginate = items.length > PAGE_SIZE;
  const page = paginate ? Math.floor(selected / PAGE_SIZE) : 0;
  return pageInfo(items, page);
}

export function renderLines(items: MenuItem[], selected: number): string[] {
  const layout = layoutForSelection(items, selected);
  const { pageItems, twoCols, leftCount, rowCount, colWidth, start, paginate, page, pages } =
    layout;
  const lines: string[] = [];
  for (let row = 0; row < rowCount; row += 1) {
    const leftIndex = start + row;
    const leftItem = pageItems[row];
    if (!leftItem) {
      continue;
    }
    const left = cell(leftItem, leftIndex, selected, colWidth);
    if (!twoCols) {
      lines.push(left);
      continue;
    }
    const rightLocal = row + leftCount;
    const rightItem = pageItems[rightLocal];
    if (rightItem) {
      const rightIndex = start + rightLocal;
      lines.push(`${left}${cell(rightItem, rightIndex, selected, colWidth)}`);
    } else {
      lines.push(left);
    }
  }
  if (paginate) {
    const more = page < pages - 1 ? "  ↓ more" : page > 0 ? "  ↑ more" : "";
    lines.push(`  ${page + 1}/${pages}${more}`);
  }
  return lines;
}

export function render(items: MenuItem[], selected: number): void {
  process.stdout.write(`${renderLines(items, selected).join("\n")}\n`);
}

export function clearRendered(rowCount: number): void {
  for (let i = 0; i < rowCount; i += 1) {
    process.stdout.write("\x1b[1A\x1b[2K");
  }
}

export function moveSelection(items: MenuItem[], selected: number, direction: Direction): number {
  const layout = layoutForSelection(items, selected);
  const { paginate, page, pages, start, twoCols, leftCount, rightCount, pageItems } = layout;
  const local = selected - start;

  if (!twoCols) {
    if (direction === "up" || direction === "left") {
      if (local > 0) {
        return selected - 1;
      }
      if (paginate && page > 0) {
        const prev = pageInfo(items, page - 1);
        return prev.start + prev.pageItems.length - 1;
      }
      return items.length - 1;
    }
    if (local < pageItems.length - 1) {
      return selected + 1;
    }
    if (paginate && page < pages - 1) {
      return (page + 1) * PAGE_SIZE;
    }
    return 0;
  }

  const inLeft = local < leftCount;
  const row = inLeft ? local : local - leftCount;
  const colLastRow = inLeft ? leftCount - 1 : rightCount - 1;

  if (direction === "down") {
    if (row < colLastRow) {
      return selected + 1;
    }
    const nextPage = paginate && page < pages - 1 ? page + 1 : 0;
    const next = pageInfo(items, nextPage);
    if (!inLeft && next.twoCols && next.rightCount > 0) {
      return next.start + next.leftCount;
    }
    return next.start;
  }
  if (direction === "up") {
    if (row > 0) {
      return selected - 1;
    }
    const prevPage = paginate && page > 0 ? page - 1 : pages - 1;
    const prev = pageInfo(items, prevPage);
    if (inLeft) {
      return prev.start + prev.leftCount - 1;
    }
    return prev.start + prev.pageItems.length - 1;
  }
  if (direction === "right") {
    if (inLeft && row < rightCount) {
      return start + leftCount + row;
    }
    return selected;
  }
  if (!inLeft) {
    return start + row;
  }
  return selected;
}

export type ScriptedKey = Direction | "enter" | "back" | "quit" | "close" | "hold";

export interface RenderFrame {
  selected: number;
  lines: string[];
  index: number;
  last: boolean;
}

export interface PromptOptions {
  keys?: ScriptedKey[];
  onRender?: (frame: RenderFrame) => void;
  selected?: number;
  closeable?: boolean;
}

function initialSelected(items: MenuItem[], selected?: number): number {
  if (items.length === 0) {
    return 0;
  }
  if (selected === undefined) {
    return 0;
  }
  return Math.min(Math.max(selected, 0), items.length - 1);
}

export function prompt(
  items: MenuItem[],
  options: PromptOptions = {},
): Promise<MenuItem | CloseRequest> {
  if (options.keys) {
    return promptScripted(items, options.keys, options.onRender, options.selected, options.closeable);
  }
  return promptInteractive(items, options.selected, options.closeable);
}

function promptScripted(
  items: MenuItem[],
  keys: ScriptedKey[],
  onRender?: (frame: RenderFrame) => void,
  selectedIndex?: number,
  closeable = false,
): Promise<MenuItem | CloseRequest> {
  return new Promise((resolve, reject) => {
    let selected = initialSelected(items, selectedIndex);
    const emit = (index: number, last: boolean) => {
      onRender?.({
        selected,
        lines: renderLines(items, selected),
        index,
        last,
      });
    };

    const restAfter = (i: number) => keys.slice(i + 1);
    emit(0, keys.length === 1 && (keys[0] === "enter" || keys[0] === "hold"));

    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (key === "hold") {
        emit(i + 1, true);
        reject(new Error("hold"));
        return;
      }
      if (key === "enter") {
        const chosen = items[selected];
        if (!chosen) {
          reject(new Error("No item selected."));
          return;
        }
        resolve(chosen);
        return;
      }
      if (key === "back") {
        reject(new Error("back"));
        return;
      }
      if (key === "quit") {
        reject(new Error("cancelled"));
        return;
      }
      if (key === "close") {
        const item = items[selected];
        if (closeable && canCloseItem(item)) {
          resolve(closeRequest(item));
          return;
        }
        continue;
      }
      if (key !== "up" && key !== "down" && key !== "left" && key !== "right") {
        reject(new Error(`Unknown scripted key: ${String(key)}`));
        return;
      }
      selected = moveSelection(items, selected, key);
      const rest = restAfter(i);
      emit(i + 1, rest.length === 1 && rest[0] === "enter");
    }
    reject(new Error("Scripted keys ended without Enter."));
  });
}

function promptInteractive(
  items: MenuItem[],
  selectedIndex?: number,
  closeable = false,
): Promise<MenuItem | CloseRequest> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      reject(new Error("Need an interactive terminal (TTY) to pick an emulator."));
      return;
    }

    let selected = initialSelected(items, selectedIndex);
    let pending = "";
    let escapeTimer: ReturnType<typeof setTimeout> | null = null;
    const drawn = () => layoutForSelection(items, selected).drawnRows;

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    hideCursor();
    render(items, selected);

    const move = (direction: Direction) => {
      const previousDrawn = drawn();
      selected = moveSelection(items, selected, direction);
      clearRendered(previousDrawn);
      render(items, selected);
    };

    const goBack = () => {
      cleanup();
      reject(new Error("back"));
    };

    const onData = (chunk: string) => {
      pending += chunk;
      if (escapeTimer) {
        clearTimeout(escapeTimer);
        escapeTimer = null;
      }

      while (pending.length > 0) {
        if (pending === "\x1b") {
          escapeTimer = setTimeout(() => {
            if (pending === "\x1b") {
              pending = "";
              goBack();
            }
          }, 35);
          return;
        }
        if (pending.startsWith("\x1b[")) {
          if (pending.length < 3) {
            return;
          }
          const seq = pending.slice(0, 3);
          pending = pending.slice(3);
          if (seq === "\x1b[A") {
            move("up");
          } else if (seq === "\x1b[B") {
            move("down");
          } else if (seq === "\x1b[C") {
            move("right");
          } else if (seq === "\x1b[D") {
            move("left");
          }
          continue;
        }
        if (pending.startsWith("\x1b")) {
          pending = "";
          goBack();
          return;
        }

        const key = pending[0];
        pending = pending.slice(1);

        if (key === "\x03" || key === "q") {
          cleanup();
          reject(new Error("cancelled"));
          return;
        }
        if (key === "c" && closeable) {
          const item = items[selected];
          if (!canCloseItem(item)) {
            continue;
          }
          cleanup();
          resolve(closeRequest(item));
          return;
        }
        if (key === "k") {
          move("up");
        } else if (key === "j") {
          move("down");
        } else if (key === "h") {
          move("left");
        } else if (key === "l") {
          move("right");
        } else if (key === "\r" || key === "\n") {
          cleanup();
          const chosen = items[selected];
          if (!chosen) {
            reject(new Error("No item selected."));
            return;
          }
          resolve(chosen);
          return;
        }
      }
    };

    const cleanup = () => {
      if (escapeTimer) {
        clearTimeout(escapeTimer);
        escapeTimer = null;
      }
      process.stdin.off("data", onData);
      restoreTerminal();
      process.stdin.pause();
    };

    process.stdin.on("data", onData);
  });
}
