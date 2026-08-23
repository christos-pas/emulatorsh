import { createEmulatorsh } from "../sdk";
import { createHostSystem } from "../system/host";
import { packageVersion } from "../version";
import { main } from "./main";
import { createLiveRuntime } from "./runtime";

const HELP = `Usage: emulatorsh [--simulate] [--simulate-clear]

  --simulate        Interactive demo. Same menus as a real run, but adb,
                    emulator, sdkmanager, avdmanager, and simctl are mocked.
                    Creates ./demo.db if needed and stores SDKs you install
                    and devices you create or start.
  --simulate-clear  Delete ./demo.db and exit.
  -V, --version     Print the version from package.json and exit.
  -h, --help        Show this help.
`;

const KNOWN = new Set(["--simulate", "--simulate-clear", "--help", "-h", "--version", "-V"]);
const DEMO_DB = "./demo.db";

function parseArgs(argv: string[]): { simulate: boolean; clear: boolean; help: boolean; version: boolean } {
  const unknown = argv.filter((arg) => !KNOWN.has(arg));
  if (unknown.length > 0) {
    console.error(`Unknown argument: ${unknown[0]}`);
    console.error(HELP);
    process.exit(1);
  }
  return {
    simulate: argv.includes("--simulate"),
    clear: argv.includes("--simulate-clear"),
    help: argv.includes("--help") || argv.includes("-h"),
    version: argv.includes("--version") || argv.includes("-V"),
  };
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

if (options.version) {
  process.stdout.write(`${packageVersion()}\n`);
  process.exit(0);
}

async function boot(): Promise<void> {
  if (options.clear) {
    const { clearSandboxStorage } = await import("../simulate");
    const { path: filePath, removed } = clearSandboxStorage(DEMO_DB);
    console.log(removed ? `Removed simulate database (${filePath}).` : `No simulate database at ${filePath}.`);
    return;
  }

  if (options.simulate) {
    const { createSandboxSystem } = await import("../simulate");
    const { closeFakeEmulator, openFakeEmulator } = await import("../demo/fake-window");
    createEmulatorsh({
      system: createSandboxSystem({
        os: "macos",
        storage: DEMO_DB,
        onDeviceStart: (kind, title, deviceId) => {
          openFakeEmulator(kind, title, deviceId);
        },
        onDeviceStop: (deviceId) => {
          closeFakeEmulator(deviceId);
        },
      }),
    });
  } else {
    createEmulatorsh({ system: createHostSystem() });
  }

  await main(createLiveRuntime());
}

void boot();
