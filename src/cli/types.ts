import type { ImageSpec } from "../sdk/types";

export type Direction = "up" | "down" | "left" | "right";

export interface MenuItem {
  name: string;
  value: string;
  label?: string;
  create?: boolean;
  installSdk?: boolean;
  accent?: "purple";
  running?: boolean;
  installed?: boolean;
  installedCount?: number;
  hint?: string;
  runningSummary?: {
    running: number;
    total: number;
  };
  avdName?: string;
  emulatorBin?: string;
  package?: string;
  api?: string;
  sysdir?: string;
  supportedSdks?: ImageSpec[];
}

export interface Layout {
  paginate: boolean;
  page: number;
  pages: number;
  start: number;
  pageItems: MenuItem[];
  twoCols: boolean;
  leftCount: number;
  rightCount: number;
  rowCount: number;
  colWidth: number;
  drawnRows: number;
}
