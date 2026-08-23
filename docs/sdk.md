# emulatorsh SDK

Same tricks as the CLI, no keyboard. Drive Android, iOS, and watchOS from TypeScript or JavaScript — list, launch, create, install, suspend, terminate. Starts **detached**. Needs the same Android SDK / Xcode setup as [Environment](../README.md#environment) in the README.

```bash
npm install emulatorsh
```

The default import talks to **your machine**:

```ts
import emulatorsh from "emulatorsh";

emulatorsh.android.start("Pixel_9_API_36");
```

Prefer a named factory? `import { createEmulatorsh, emulatorsh } from "emulatorsh"` is the same live client.

The CLI is menus on top of this. Every device operation it can do is here.

```ts
emulatorsh.helpers.isAppleDeviceId("06133482-749C-4A5D-9D27-8E082984CB91");
emulatorsh.helpers.appleDisplayName({ name: "iPhone 16", runtime: "iOS 18.4" });
// "iPhone 16 (iOS 18.4)"
```

## Platforms

The first CLI screen, without the prompt:

```ts
emulatorsh.platforms.list();
// [
//   { name: "android", installed: 4, running: 1 },
//   { name: "ios", installed: 2, running: 0 },
//   { name: "watchos", installed: 1, running: 0 },
// ]
```

`name` is `"android"` | `"ios"` | `"watchos"`. `installed` is how many devices exist. `running` is how many are up. All three rows are always there — Apple is zeros on Linux / Windows.

## List / inspect

```ts
emulatorsh.android.list();
emulatorsh.ios.list();
emulatorsh.watchos.list();
```

Each item includes `running`. `get` returns that same object, or throws — the CLI never calls it; it just lists.

```ts
const pixel = emulatorsh.android.get("Pixel_9_API_36");
const phone = emulatorsh.ios.get("iPhone 16");          // or a UDID, or "iPhone 16 (iOS 18.4)"
```

## Run / stop

`start` / `suspend` / `terminate` take a device from `list()`, or a string: AVD name on Android, UDID **or** simulator name on iOS / watchOS. If several simulators share a name, pass the labeled name or the UDID.

```ts
emulatorsh.android.start("Pixel_9_API_36");
emulatorsh.android.suspend("Pixel_9_API_36");   // graceful close — next boot can Quick Boot
emulatorsh.android.terminate("Pixel_9_API_36"); // cold boot next time; apps and userdata stay

if (!pixel.running) {
  emulatorsh.android.start(pixel);
}

emulatorsh.ios.start("iPhone 16");
emulatorsh.ios.suspend("iPhone 16");            // simctl shutdown — Apple has no terminate

emulatorsh.watchos.start("Apple Watch Series 10");
emulatorsh.watchos.suspend("Apple Watch Series 10");
```

## New Android device directly from the SDK

This is the extra CLI wizard: form factor → system image → skin → create → start.

```ts
emulatorsh.android.images.listInstalled("phone"); // or "wear"
emulatorsh.android.images.listAvailable("phone");
await emulatorsh.android.images.install(image);

emulatorsh.android.profiles.list("36");          // or a listed image
const created = await emulatorsh.android.create(image, profile);
emulatorsh.android.start(created);
```

If you already know the names, skip the lists. The client checks that the profile exists and that the SDK is installed:

```ts
const created = await emulatorsh.android.create("36", "Pixel_9");
emulatorsh.android.start(created);
```

`"Pixel_9"` / `"Pixel 9"` / `"pixel_9"` all work. The SDK can be an API (`"36"`, `"API 36"`), a display name (`API 36 — google_apis_playstore (arm64-v8a)`), or a `system-images;...` package. If several images share that API, playstore wins.

Not installed yet? Download it first:

```ts
const created = await emulatorsh.android.create("36", "Pixel 9", { installDeps: true });
```

`profiles.list` uses the same lookup. Phone vs wear comes from the image tag — no second argument:

```ts
const profile = emulatorsh.android.profiles.list("36").find((item) => item.id === "pixel_9");
```

Creating does **not** auto-start. `create` always returns a `Promise` and a device, or throws. Hardware keyboard is on.

## Playground, for tests

CLI `--simulate` has a sibling. Point a client at a sandbox and nothing on the real SDK or Simulator moves:

```ts
import { createEmulatorsh } from "emulatorsh";
import { createSandboxSystem } from "emulatorsh/simulate";

const demo = createEmulatorsh({
  system: createSandboxSystem({ os: "macos", storage: "./db/demo.db" }),
});

demo.platforms.list();
demo.android.list();
```

Each client closes over its `system`. Two sandboxes never share devices, installs, or running flags:

```ts
const em1 = createEmulatorsh({ system: sys1 });
const em2 = createEmulatorsh({ system: sys2 });
```

`os` is `"macos"`, `"linux"`, or `"windows"`. Apple simulators only exist on `"macos"` — a Windows sandbox is Android-only. Wipe `db/demo.db` when you are done, same idea as `emulatorsh --simulate-clear`. Sandbox needs **Node.js 22.5+**.
