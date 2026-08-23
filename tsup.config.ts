import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli/index.ts",
    index: "src/index.ts",
    "system/index": "src/system/index.ts",
    "simulate/index": "src/simulate/index.ts",
    "demo/record-gif": "src/demo/record-gif.ts",
    "simulate/refresh-data": "src/simulate/refresh-data.ts",
  },
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
