# emulatorsh SDK

Same tricks as the CLI, no keyboard. Drive Android, iOS, and watchOS from TypeScript or JavaScript — list, launch, create, install, suspend, terminate. Starts **detached**. Needs the same Android SDK / Xcode setup as [Environment](../README.md#environment) in the README.

```bash
npm install emulatorsh
```

The default import talks to **your machine**:

```ts
import emulatorsh from "emulatorsh";

const pixel = emulatorsh.android.list().find((device) => device.value === "Pixel_9_API_36");
if (pixel && !pixel.running) {
  emulatorsh.android.start(pixel);
}
```

`device.value` is the AVD name on Android, and the simulator UDID on iOS / watchOS. `device.running` is the green `[running]` you already know from the menus.

Prefer a named factory? `import { createEmulatorsh, emulatorsh } from "emulatorsh"` is the same live client.

## Launch, pause, kill

```ts
emulatorsh.android.start(pixel);
emulatorsh.android.suspend(pixel);   // graceful close — next boot can Quick Boot
emulatorsh.android.terminate(pixel); // cold boot next time; apps and userdata stay

const iphone = emulatorsh.ios.list().find((device) => device.name.includes("iPhone 16"));
if (iphone) {
  emulatorsh.ios.start(iphone);
  emulatorsh.ios.suspend(iphone);    // simctl shutdown — Apple has no terminate
}

const watch = emulatorsh.watchos.list()[0];
if (watch) {
  emulatorsh.watchos.start(watch);
  emulatorsh.watchos.suspend(watch);
}
```

## New Android device, no Android Studio

```ts
let image = emulatorsh.android.images.listInstalled("phone")[0];
if (!image) {
  const toInstall = emulatorsh.android.images.listAvailable("phone").find((item) => !item.installed);
  if (!toInstall) {
    throw new Error("No phone system image to install.");
  }
  await emulatorsh.android.images.install(toInstall.package);
  image = emulatorsh.android.images.listInstalled("phone").find((item) => item.package === toInstall.package);
}
if (!image) {
  throw new Error("No phone system image installed.");
}

const profiles = emulatorsh.android.profiles.list(image, "phone");
const profile = profiles.find((item) => item.value === "pixel_9") ?? profiles[0];
if (!profile) {
  throw new Error("No phone profile for that image.");
}

const name = emulatorsh.android.create(image, profile); // hardware keyboard on
const created = emulatorsh.android.list().find((device) => device.value === name);
if (created) {
  emulatorsh.android.start(created);
}
```

Form factor is `"phone"` or `"wear"`. Creating does **not** auto-start — call `start` when you want the window. Installing a system image is the one call that returns a `Promise`.

## Playground, for tests

CLI `--simulate` has a sibling. Point a client at a sandbox and nothing on the real SDK or Simulator moves:

```ts
import { createEmulatorsh } from "emulatorsh";
import { createSandboxSystem } from "emulatorsh/simulate";

const demo = createEmulatorsh({
  system: createSandboxSystem({ os: "macos", storage: "./demo.db" }),
});

demo.android.list();
```

`os` is `"macos"`, `"linux"`, or `"windows"`. Apple simulators only exist on `"macos"` — a Windows sandbox is Android-only. Wipe the playground file when you are done, same idea as `emulatorsh --simulate-clear`. Sandbox needs **Node.js 22.5+**.
