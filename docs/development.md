# Development

From a clone:

```bash
git clone https://github.com/christos-pas/emulatorsh.git
cd emulatorsh
npm install
npm run build
npm link            # optional: put `emulatorsh` on your PATH
```

```bash
npm run dev         # tsup watch
npm run build       # emit dist/cli.js
npm start           # node dist/cli.js
npm run typecheck
npm test
npm run refresh-demo-data  # snapshot this machine's SDKs/devices into src/demo/data.ts
npm run record-gif  # real TUI + mock backend → docs/screens/usage.gif
```

To rebuild `src/demo/data.ts` from the SDKs and devices on this machine (convenience only; not used at runtime):

```bash
npm run refresh-demo-data
npm run refresh-demo-data -- --dry-run   # print counts without writing
```

That walks `sdkmanager --list` (all downloadable images, not only installed), `avdmanager` device definitions, and iOS / watchOS simulators, then writes the fixture that `--simulate` commits to git. Re-record the GIF afterwards if the menus change: `npm run record-gif`.

`record-gif` and `--simulate` share the fixture in `src/demo/data.ts`. The GIF recorder still drives `main()` with scripted keys and an in-memory catalog (no SQLite). `--simulate` runs the same listing/install/start functions; `adb` / `emulator` / `sdkmanager` / `avdmanager` / `simctl` (and the SDK/AVD filesystem) are mocked and persist into `demo.db`. Rasterization is 2× SVG via `@resvg/resvg-js`, encoded with `gifenc`.

Stack: **TypeScript** + **tsup** (esbuild). Runtime dependency-free; Node built-ins only. GIF tooling is dev-only.

## Publish to npm

First release (`0.1.0` is already set):

```bash
npm login
npm publish --dry-run
npm publish --access public
git tag -a v0.1.0 -m "v0.1.0"
git push origin main --follow-tags
```

Later releases:

```bash
npm version patch   # or minor / major — bumps package.json, commits, and tags vX.Y.Z
npm publish --access public
git push origin main --follow-tags
```

`publishConfig.access` is `public`. `prepublishOnly` builds, typechecks, and runs tests first.
