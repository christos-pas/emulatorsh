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

Releases are published from GitHub Actions (`.github/workflows/publish.yml`) with [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/). That attaches a Provenance attestation. Do not `npm publish` from a laptop for tagged releases.

One-time setup on [the package settings](https://www.npmjs.com/package/emulatorsh/access):

1. **Trusted Publisher** → GitHub Actions
2. User `christos-pas`, repository `emulatorsh`, workflow filename `publish.yml` (filename only)
3. Environment name: `npm`
4. Allowed action: `npm publish`

The publish job uses the GitHub Actions environment `npm`. Create it once under the repo **Settings → Environments** if it is not there yet.

Then, from a clean `main`:

```bash
npm run release              # patch: bump package.json, commit, tag vX.Y.Z
npm run release -- minor
npm run release -- major
npm run release -- patch --push   # also git push --follow-tags
```

`package.json` `"version"` is the only version number. `npm version` updates `package-lock.json` and the git tag. The CLI reads that same field (`emulatorsh --version`). Configure the Trusted Publisher before the first tag push, or the publish job will fail with `ENEEDAUTH`.

`publishConfig.access` is `public` and `provenance` is `true`. `prepublishOnly` builds, typechecks, and runs tests first. CI (`.github/workflows/ci.yml`) runs typecheck and tests on every push and pull request to `main`.
