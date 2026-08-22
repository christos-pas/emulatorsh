# Contributing

PRs are welcome. Issues too — a bug you hit on a real emulator is worth more than a perfect patch.

## Before you write code

1. Open an issue if the change is more than a small fix, so we agree on the shape first.
2. Fork the repo and branch off `main`.

## Dev setup

Clone, install, and run the checks. Details and extra scripts live in [Development](docs/development.md).

```bash
npm install
npm run build
npm run typecheck
npm test
```

`emulatorsh --simulate` is the safe way to click through the UI with no Android SDK or Xcode.

## What a good PR looks like

- One idea per PR.
- `npm test` and `npm run typecheck` stay green. CI runs those on every pull request.
- Match the style already in `src/`. No new runtime npm dependencies.
- If you change menus, mention whether `docs/screens/usage.gif` needs a re-record (`npm run record-gif`).

## Opening the PR

Push your branch and open a pull request against `main`. Say what you changed and how you tried it (live devices, `--simulate`, or both).

I will review when I can, that's a weekend project so please don't hate me if it takes a while.
Thank you for taking the time. :)
