export type FormFactor = "phone" | "wear";

export type Direction = "up" | "down" | "left" | "right";

export interface ImageSpec {
  api: string;
  tag: string;
}

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

export interface SystemImage extends MenuItem {
  package: string;
  api: string;
  sysdir?: string;
}

export interface DeviceDefinition {
  id: string;
  name: string;
  tag: string;
}

export interface ExistingAvd {
  name: string;
  deviceName: string;
  sysdir: string;
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

export interface ExecOutputError extends Error {
  stdout?: string;
  stderr?: string;
}
