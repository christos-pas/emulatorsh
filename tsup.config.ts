import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/demo/record-gif.ts", "src/demo/refresh-data.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  external: ["@resvg/resvg-js"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
