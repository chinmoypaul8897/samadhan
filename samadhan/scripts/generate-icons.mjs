// Render public/icon.svg → PWA PNG icons + app favicon. Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "public", "icon.svg");

const targets = [
  { size: 192, out: join(root, "public", "icon-192.png") },
  { size: 512, out: join(root, "public", "icon-512.png") },
  { size: 512, out: join(root, "public", "icon-maskable-512.png") },
  { size: 180, out: join(root, "public", "apple-touch-icon.png") },
  { size: 256, out: join(root, "src", "app", "icon.png") }, // Next favicon
];

await Promise.all(
  targets.map(({ size, out }) =>
    sharp(src).resize(size, size).png().toFile(out),
  ),
);

console.log(`generated ${targets.length} icons from icon.svg`);
