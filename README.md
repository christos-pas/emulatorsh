# >_ emulatorsh📱

Interactive terminal UI to **list, create, and launch** Android Virtual Devices and iOS Simulators. The command is **`emulatorsh`**:, from the shell.

![Usage](./docs/screens/usage.gif)

Pick a platform, pick a device, and the process starts **detached** so you can close the terminal. On Android you can also install system images and create new AVDs without opening Android Studio.

Teal `>` is the cursor. Green is **running** or **already installed**. On the platform list, `[running: 1/3]` is green when any device is up and gray when the count is `0`. Purple is a create/install action. Long lists split into **two columns** and paginate (`1/2 ↓ more`).

Version **0.1.0**. Licensed under [MIT](./LICENSE).

## Why

I got tired of opening Android Studio just to boot a Pixel.

Creating an AVD meant clicking through Device Manager, waiting on a system image, then discovering the hardware keyboard was off — so every login screen, every text field, I was poking at a fake on-screen keyboard. Turning `hw.keyboard=yes` meant hunting `config.ini` by hand. Doing that once is annoying. Doing it every time I needed a clean API level or a Wear device was a waste of an afternoon.

The Android Studio meanwhile kept changing how emulators launch. Sometimes the window is its own process. Sometimes it boots *inside* the IDE and I still don't fully know why — a setting, a toolbar button, a new Device Manager. I just wanted a device running so I could run tests, not debug the IDE.

iOS is not innocent either. `xcrun simctl` works, if you enjoy UDIDs. I was already in a terminal. I did not want to leave it.

So I wrapped the tools I already had — `emulator`, `avdmanager`, `sdkmanager`, `simctl` — in one keyboard UI. Pick a platform, pick a device, it starts detached so closing the terminal does not kill the emulator. New Android devices get a hardware keyboard without me opening an ini file. Running devices are marked so I do not boot a second copy by mistake.

This is the tool I wished I had on the days I lost an hour to Device Manager. If you have lived that, it is for you too.

No runtime npm dependencies. It shells out to the SDK and Xcode on your machine.

## What it does

1. Asks **Android**, **iOS**, or **watchOS**, each with `[running: n/total]` (green if any are up, gray if none).
2. **iOS** / **watchOS** — lists available simulators from `xcrun simctl` for that runtime. Booted devices are marked green `[running]`. Selecting one boots it and opens the Simulator app.
3. **Android** — lists AVDs from `emulator -list-avds`. Running AVDs are marked green `[running]`. Selecting one starts it detached. The last row is purple **Create new device**.
4. On a device list, **`c`** closes the highlighted running device: **Back** returns to the list; **Suspend** or **Terminate** runs the command and exits. Android **Suspend** is a graceful `adb emu kill` so Quick Boot can save a snapshot (next start is not a cold boot). **Terminate** force-kills the emulator and deletes that AVD’s Quick Boot snapshots so the next start is a cold boot — installed apps and userdata stay; it is not a wipe. iOS and watchOS only offer **Suspend** (`simctl shutdown` — it keeps the simulator disk, like a soft shutdown). In `--simulate`, that updates `demo.db` and closes the fake window if it is still open.

### Create a new Android device

1. Form factor: **Mobile Phone** or **Wear**.
2. Installed system image (or purple **Install new SDK**).
3. Device profile, shown as `Pixel_9_Pro_API_36` for the selected SDK. Already-created copies show `[installed: n]`. A `_2` / `_3` suffix is added only when creating, if that name is already taken.
4. Creates the AVD with `avdmanager`, enables `hw.keyboard=yes`, and starts it.

If no Wear or phone system image is installed, the SDK list shows orange `No SDK installed` plus **Install new SDK**.

Installing an SDK skips the SDK list and opens the device list for that image. Escape from devices returns to the SDK list with the new image selected. Selecting an already-installed SDK in the install list does nothing (returns to the list).

## Install

This package is not published yet. From a clone:

```bash
cd ~/git/android-ios-emulators-cli
npm install
npm run build
npm link
```

Then run:

```bash
emulatorsh
```

Demo mode (no Android SDK or Xcode; fixture devices from `src/demo/data.ts`):

```bash
emulatorsh --simulate
emulatorsh --simulate-clear   # delete ./demo.db
```

`--simulate` uses the same listing/install/start code as a real run. Without `--simulate`, emulatorsh keeps **no local database or cache**: every list comes from `adb` / `emulator` / `sdkmanager` / `avdmanager` / `simctl` (and the SDK/AVD files those tools already own). The only writes are `hw.keyboard=yes` on a newly created AVD and emulator logs at `/tmp/emulator.log`.

With `--simulate`, those CLIs are mocked and persist into gitignored `./demo.db`. The fixture in `src/demo/data.ts` is a snapshot of this machine. Rebuild it with `npm run refresh-demo-data`. Device profiles that do not support the selected SDK are hidden. `--simulate` needs **Node.js 22.5+** (`node:sqlite`). The live command still runs on Node 18.

To rebuild `src/demo/data.ts` from the SDKs and devices on this machine (convenience only; not used at runtime):

```bash
npm run refresh-demo-data
npm run refresh-demo-data -- --dry-run   # print counts without writing
```

That walks `sdkmanager --list` (all downloadable images, not only installed), `avdmanager` device definitions, and iOS / watchOS simulators, then writes the fixture that `--simulate` commits to git. Re-record the GIF afterwards if the menus change: `npm run record-gif`.

Without linking:

```bash
npm start
# or
node dist/cli.js
```

When published on npm:

```bash
npm install -g emulatorsh
emulatorsh
```

Requires **Node.js 18+**.

## Keyboard

| Key | Action |
| --- | --- |
| `↑` `↓` or `k` `j` | Move |
| `←` `→` or `h` `l` | Move between columns (when the list is two-column) |
| Enter | Select |
| Escape | Back one step |
| `c` | Close the selected **running** device (suspend or terminate) |
| `q` or Ctrl+C | Quit |

Lists with more than 8 items use **two columns** when the terminal is at least 72 characters wide. Long lists paginate (**20 items per page**). The footer shows `2/5 ↓ more`.

Needs an **interactive TTY**. Piped or non-TTY stdin/stdout will exit with an error.

## Environment

The CLI does not install Android Studio or Xcode. It shells out to tools that must already be on the machine.

### Android

Set one of these (first existing directory wins):

| Variable | Role |
| --- | --- |
| `ANDROID_SDK_ROOT` | Preferred SDK root |
| `ANDROID_HOME` | Fallback SDK root |
| `ANDROID_AVD_HOME` | Optional AVD directory (default `~/.android/avd`) |

If those env vars are unset, the CLI also looks at:

- `~/Library/Android/sdk` (macOS Android Studio default)
- `~/Android/Sdk` (Linux default)
- then infers the root from a found `emulator` binary

Required binaries (resolved under the SDK root, then `PATH`):

| Tool | Typical path |
| --- | --- |
| `emulator` | `$SDK/emulator/emulator` |
| `adb` | `$SDK/platform-tools/adb` |
| `avdmanager` | `$SDK/cmdline-tools/latest/bin/avdmanager` |
| `sdkmanager` | `$SDK/cmdline-tools/latest/bin/sdkmanager` |

`avdmanager` / `sdkmanager` are also searched in other `cmdline-tools/<version>/bin` folders and the legacy `$SDK/tools/bin` location.

**Minimum Android setup**

1. [Android Studio](https://developer.android.com/studio) **or** a standalone [command-line tools](https://developer.android.com/studio#command-line-tools-only) install.
2. SDK **Command-line Tools**, **Platform-Tools**, and **Emulator** packages.
3. At least one **system image** if you want to create devices from the CLI (`sdkmanager` or Android Studio SDK Manager).
4. Accept licenses: `sdkmanager --licenses`.

Example `~/.zshrc`:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

System images are filtered to the **host ABI**: `arm64-v8a` on Apple Silicon, `x86_64` otherwise. Wear images use tags matching `wear` (for example `android-wear`, `android-wear-signed`), not phone `google_apis_playstore`. China-only Wear tags (`*-cn`) are skipped.

Android emulator stdout/stderr go to **`/tmp/emulator.log`**.

### iOS (macOS only)

1. [Xcode](https://developer.apple.com/xcode/) from the Mac App Store.
2. Open Xcode once and install additional platforms if prompted.
3. `xcrun simctl` must work (`xcode-select` pointing at Xcode).

Devices come from `xcrun simctl list devices available -j`. **iOS** shows `iOS-<major>` / `iOS-<major>-<minor>` runtimes. **watchOS** shows `watchOS-*` the same way (Apple Watch simulators). tvOS and visionOS are not listed. Starting a simulator runs `simctl boot <udid>` and `open -a Simulator`.

There is no “create simulator” flow: Apple devices are Xcode runtime definitions, not AVDs.

## Development

```bash
npm install
npm run dev         # tsup watch
npm run build       # emit dist/cli.js
npm run typecheck
npm test
npm run refresh-demo-data  # snapshot this machine's SDKs/devices into src/demo/data.ts
npm run record-gif  # real TUI + mock backend → docs/screens/usage.gif
```

`record-gif` and `--simulate` share the fixture in `src/demo/data.ts`. The GIF recorder still drives `main()` with scripted keys and an in-memory catalog (no SQLite). `--simulate` runs the same listing/install/start functions; `adb` / `emulator` / `sdkmanager` / `avdmanager` / `simctl` (and the SDK/AVD filesystem) are mocked and persist into `demo.db`. Rasterization is 2× SVG via `@resvg/resvg-js`, encoded with `gifenc`.

Stack: **TypeScript** + **tsup** (esbuild). Runtime dependency-free; Node built-ins only. GIF tooling is dev-only.

## Publish to npm

1. Remove `"private": true` from `package.json` (if present).
2. `npm login` and `npm publish --access public`.

`prepublishOnly` builds, typechecks, and runs tests first.

## License

[MIT](./LICENSE) © [Christos S. Paschalidis](https://github.com/christos-pas)
