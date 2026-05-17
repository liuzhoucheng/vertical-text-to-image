import { build } from "esbuild";

await build({
  entryPoints: ["src/h2c-vertical-typesetter.js"],
  outfile: "dist/h2c-vertical-typesetter.global.js",
  bundle: true,
  format: "iife",
  globalName: "H2CVerticalTypesetter",
  platform: "browser",
  target: "es2018",
  minify: true,
});
