/**
 * scripts/copy-icons.mjs
 *
 * Copies the source icon to public/icon/ as 128.png (for manual/CI use).
 * WXT's @wxt-dev/auto-icons module can handle resizing automatically.
 * For now, use one icon at all sizes (Chrome accepts identical PNGs for all sizes).
 */

import { copyFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "public", "icon", "source.png");
const sizes = [16, 48, 128];

if (!existsSync(src)) {
  console.error("Source icon not found at public/icon/source.png");
  console.error("Please place your 128x128+ PNG there and re-run this script.");
  process.exit(1);
}

mkdirSync(join(root, "public", "icon"), { recursive: true });

for (const size of sizes) {
  const dest = join(root, "public", "icon", `${size}.png`);
  copyFileSync(src, dest);
  console.log(`✓ Copied → public/icon/${size}.png`);
}

console.log("Done. For proper resizing, run: pnpm add -D @wxt-dev/auto-icons");
