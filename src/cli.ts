import { createLiveRuntime } from "./runtime.js";
import { main } from "./flows.js";

const HELP = `Usage: emulatorsh [--simulate] [--simulate-clear]

  --simulate        Interactive demo. Same menus as a real run, but adb,
                    emulator, sdkmanager, avdmanager, and simctl are mocked.
                    Creates ./demo.db if needed and stores SDKs you install
                    and devices you create or start.
  --simulate-clear  Delete ./demo.db and exit.
  -h, --help        Show this help.
`;

const KNOWN = new Set(["--simulate", "--simulate-clear", "--help", "-h"]);

function parseArgs(argv: string[]): { simulate: boolean; clear: boolean; help: boolean } {
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
  };
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

async function boot(): Promise<void> {
  if (options.clear) {
    const { clearDemoDb } = await import("./demo/store.js");
    const { path: filePath, removed } = clearDemoDb();
    console.log(removed ? `Removed simulate database (${filePath}).` : `No simulate database at ${filePath}.`);
    return;
  }

  if (options.simulate) {
    const { enableSimulate } = await import("./demo/mode.js");
    const { openDemoDb } = await import("./demo/store.js");
    const tools = await import("./demo/tools.js");
    const { demoProfiles } = await import("./demo/data.js");
    enableSimulate({
      exec: {
        mockExecFile: tools.mockExecFile,
        mockSpawn: tools.mockSpawn,
      },
      fs: {
        isMockFsPath: tools.isMockFsPath,
        isMockLogPath: tools.isMockLogPath,
        mockExistsSync: tools.mockExistsSync,
        mockReadFileSync: tools.mockReadFileSync,
        mockReaddirSync: tools.mockReaddirSync,
        mockStatSync: tools.mockStatSync,
        mockWriteFileSync: tools.mockWriteFileSync,
      },
      profileSdks: new Map(
        demoProfiles().map((profile) => [profile.value, profile.supportedSdks]),
      ),
    });
    openDemoDb();
  }

  await main(createLiveRuntime());
}

void boot();
