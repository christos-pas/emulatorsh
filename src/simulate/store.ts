import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { DEMO_DB_FILENAME, DEMO_PLATFORM } from "./constants";

export type DemoPlatform =
  | typeof DEMO_PLATFORM.android
  | typeof DEMO_PLATFORM.ios
  | typeof DEMO_PLATFORM.watchos;

export interface StoredSdk {
  platform: string;
  name: string;
}

export interface StoredDevice {
  platform: string;
  name: string;
  IsRunning: boolean;
  deviceName?: string;
  sysdir?: string;
}

interface DemoDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): unknown;
  };
  close(): void;
}

export interface SandboxStore {
  readonly path: string;
  listStoredSdks(platform?: string): StoredSdk[];
  listStoredDevices(platform?: DemoPlatform): StoredDevice[];
  addStoredSdk(platform: string, name: string): void;
  upsertStoredDevice(
    platform: string,
    name: string,
    running: boolean,
    meta?: { deviceName?: string; sysdir?: string },
  ): void;
  rememberFakeWindow(deviceId: string, pid: number, dir?: string): void;
  takeFakeWindows(deviceId: string): { pid: number; dir?: string }[];
  close(): void;
  clear(): { path: string; removed: boolean };
}

const require = createRequire(import.meta.url);
let sqliteWarningSuppressed = false;

function suppressSqliteExperimentalWarning(): void {
  if (sqliteWarningSuppressed) {
    return;
  }
  sqliteWarningSuppressed = true;
  const original = process.emitWarning;
  process.emitWarning = ((warning: unknown, ...args: unknown[]) => {
    const type = typeof args[0] === "string" ? args[0] : warning instanceof Error ? warning.name : "";
    const message = warning instanceof Error ? warning.message : String(warning ?? "");
    if (type === "ExperimentalWarning" && /sqlite/i.test(message)) {
      return;
    }
    return original.call(process, warning as string, ...(args as []));
  }) as typeof process.emitWarning;
}

function sidecarPaths(filePath: string): string[] {
  return [filePath, `${filePath}-wal`, `${filePath}-shm`, `${filePath}-journal`];
}

function openSqlite(filePath: string): DemoDatabase {
  suppressSqliteExperimentalWarning();
  let DatabaseSync: new (path: string) => DemoDatabase;
  try {
    ({ DatabaseSync } = require("node:sqlite") as {
      DatabaseSync: new (path: string) => DemoDatabase;
    });
  } catch {
    throw new Error(
      "emulatorsh --simulate needs Node.js 22.5+ (built-in node:sqlite). The live CLI still works on Node 18.",
    );
  }
  return new DatabaseSync(filePath);
}

function addColumnIfMissing(db: DemoDatabase, table: string, column: string, type: string): void {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch {
    // column already exists
  }
}

export function createSandboxStore(filePath: string): SandboxStore {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = openSqlite(resolved);
  db.exec(`
    CREATE TABLE IF NOT EXISTS SDKs (
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (platform, name)
    );
    CREATE TABLE IF NOT EXISTS InstalledDevices (
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      IsRunning INTEGER NOT NULL DEFAULT 0,
      deviceName TEXT,
      sysdir TEXT,
      PRIMARY KEY (platform, name)
    );
    CREATE TABLE IF NOT EXISTS FakeWindows (
      deviceId TEXT NOT NULL,
      pid INTEGER NOT NULL,
      dir TEXT,
      PRIMARY KEY (deviceId, pid)
    );
  `);
  addColumnIfMissing(db, "InstalledDevices", "deviceName", "TEXT");
  addColumnIfMissing(db, "InstalledDevices", "sysdir", "TEXT");
  addColumnIfMissing(db, "FakeWindows", "dir", "TEXT");

  let closed = false;

  const store: SandboxStore = {
    path: resolved,
    listStoredSdks(platform = DEMO_PLATFORM.android) {
      return db
        .prepare("SELECT platform, name FROM SDKs WHERE platform = ? ORDER BY rowid DESC")
        .all(platform) as StoredSdk[];
    },
    listStoredDevices(platform) {
      const rows = platform
        ? (db
            .prepare(
              "SELECT platform, name, IsRunning, deviceName, sysdir FROM InstalledDevices WHERE platform = ? ORDER BY rowid ASC",
            )
            .all(platform) as {
            platform: string;
            name: string;
            IsRunning: number;
            deviceName?: string | null;
            sysdir?: string | null;
          }[])
        : (db
            .prepare(
              "SELECT platform, name, IsRunning, deviceName, sysdir FROM InstalledDevices ORDER BY rowid ASC",
            )
            .all() as {
            platform: string;
            name: string;
            IsRunning: number;
            deviceName?: string | null;
            sysdir?: string | null;
          }[]);
      return rows.map((row) => ({
        platform: row.platform,
        name: row.name,
        IsRunning: Boolean(row.IsRunning),
        deviceName: row.deviceName || undefined,
        sysdir: row.sysdir || undefined,
      }));
    },
    addStoredSdk(platform, name) {
      db.prepare("INSERT OR IGNORE INTO SDKs (platform, name) VALUES (?, ?)").run(platform, name);
    },
    upsertStoredDevice(platform, name, running, meta) {
      db.prepare(
        `INSERT INTO InstalledDevices (platform, name, IsRunning, deviceName, sysdir) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(platform, name) DO UPDATE SET
           IsRunning = excluded.IsRunning,
           deviceName = COALESCE(excluded.deviceName, InstalledDevices.deviceName),
           sysdir = COALESCE(excluded.sysdir, InstalledDevices.sysdir)`,
      ).run(platform, name, running ? 1 : 0, meta?.deviceName ?? null, meta?.sysdir ?? null);
    },
    rememberFakeWindow(deviceId, pid, dir) {
      db.prepare("INSERT OR IGNORE INTO FakeWindows (deviceId, pid, dir) VALUES (?, ?, ?)").run(
        deviceId,
        pid,
        dir ?? null,
      );
    },
    takeFakeWindows(deviceId) {
      const rows = db.prepare("SELECT pid, dir FROM FakeWindows WHERE deviceId = ?").all(deviceId) as {
        pid: number;
        dir?: string | null;
      }[];
      db.prepare("DELETE FROM FakeWindows WHERE deviceId = ?").run(deviceId);
      return rows
        .map((row) => ({
          pid: Number(row.pid),
          dir: row.dir || undefined,
        }))
        .filter((row) => Number.isInteger(row.pid) && row.pid > 0);
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      db.close();
    },
    clear() {
      store.close();
      return deleteSandboxFiles(resolved);
    },
  };

  return store;
}

function deleteSandboxFiles(filePath: string): { path: string; removed: boolean } {
  let removed = false;
  for (const candidate of sidecarPaths(filePath)) {
    if (fs.existsSync(candidate)) {
      fs.rmSync(candidate);
      removed = true;
    }
  }
  return { path: filePath, removed };
}

export function clearSandboxStorage(storage = path.resolve(process.cwd(), DEMO_DB_FILENAME)): {
  path: string;
  removed: boolean;
} {
  return deleteSandboxFiles(path.resolve(storage));
}

export function demoDbPath(): string {
  return path.resolve(process.cwd(), DEMO_DB_FILENAME);
}
