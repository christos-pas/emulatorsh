export type FormFactor = "phone" | "wear";

export type PlatformName = "android" | "ios" | "watchos";

export interface Platform {
  name: PlatformName;
  installed: number;
  running: number;
}

export type Direction = "up" | "down" | "left" | "right";

export interface ImageSpec {
  api: string;
  tag: string;
}

export interface AndroidDevice {
  name: string;
  running: boolean;
}

export interface AppleDevice {
  name: string;
  id: string;
  running: boolean;
  runtime: string;
}

export interface SystemImage {
  name: string;
  package: string;
  api: string;
  installed?: boolean;
  sysdir?: string;
}

export interface DeviceProfile {
  id: string;
  name: string;
  avdName: string;
  installedCount: number;
}

export type AndroidRef = string | Pick<AndroidDevice, "name">;
export type AppleRef = string | Pick<AppleDevice, "id"> | Pick<AppleDevice, "name"> | AppleDevice;
export type ImageRef = string | Pick<SystemImage, "package"> | SystemImage;

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
