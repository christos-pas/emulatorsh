import { spawnSync } from "node:child_process";

const bump = process.argv[2] ?? "patch";
const push = process.argv.includes("--push");

if (!["patch", "minor", "major"].includes(bump)) {
  console.error("Usage: npm run release -- [patch|minor|major] [--push]");
  process.exit(1);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const dirty = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
if (dirty.status !== 0 || dirty.stdout.trim() !== "") {
  console.error("Working tree is not clean. Commit or stash first.");
  process.exit(1);
}

run("npm", ["run", "typecheck"]);
run("npm", ["test"]);
run("npm", ["version", bump, "-m", "v%s"]);

if (push) {
  run("git", ["push", "--follow-tags"]);
} else {
  console.log("Tagged locally. Review, then publish the tag:");
  console.log("  git push --follow-tags");
}
