// Generate on-brand before/after demo photos for the C14 canonical seed.
// Deterministic + offline (no scraped internet images → no dead-URL risk, and no
// fabrication of "this is a real <place> photo"). Typographic Cohere-style cards using
// the DESIGN.md tokens: a muted dark "BEFORE" card + a deep-green "AFTER · RESOLVED" card
// per category. Run: node scripts/gen-demo-assets.mjs  → writes scripts/demo-assets/*.jpg
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "demo-assets");
mkdirSync(outDir, { recursive: true });

// serviceCode → display name + group accent (DESIGN.md semantic map).
const ACCENT = { roads: "#ff7759", water: "#1863dc", sanitation: "#5f9b3a", electricity: "#e0a400", other: "#93939f" };
const CATEGORIES = [
  { code: "pothole", name: "Pothole", group: "roads" },
  { code: "garbage_dump", name: "Garbage dump", group: "sanitation" },
  { code: "streetlight", name: "Streetlight", group: "electricity" },
  { code: "water_leak", name: "Water leak", group: "water" },
  { code: "sewer_overflow", name: "Sewer overflow", group: "water" },
  { code: "power_outage", name: "Power outage", group: "electricity" },
  { code: "stagnant_water", name: "Stagnant water", group: "sanitation" },
  { code: "dead_animal", name: "Dead animal", group: "sanitation" },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function beforeSvg(name, accent) {
  return `<svg width="1200" height="900" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#26262e"/><stop offset="1" stop-color="#101013"/>
  </linearGradient></defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <rect x="0" y="0" width="16" height="900" fill="${accent}"/>
  <text x="64" y="100" font-family="sans-serif" font-size="26" letter-spacing="8" fill="#7c7c88">SAMADHAN</text>
  <rect x="64" y="132" width="168" height="50" rx="25" fill="${accent}"/>
  <text x="148" y="166" font-family="sans-serif" font-size="22" letter-spacing="4" fill="#111114" text-anchor="middle">BEFORE</text>
  <text x="62" y="500" font-family="sans-serif" font-weight="700" font-size="96" fill="#ffffff">${esc(name)}</text>
  <rect x="64" y="792" width="1072" height="2" fill="#39393f"/>
  <circle cx="80" cy="846" r="9" fill="${accent}"/>
  <text x="104" y="856" font-family="sans-serif" font-size="30" fill="#9a9aa4">Reported · awaiting resolution</text>
</svg>`;
}

function afterSvg(name) {
  return `<svg width="1200" height="900" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#02584c"/><stop offset="1" stop-color="#003027"/>
  </linearGradient></defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <rect x="0" y="0" width="16" height="900" fill="#edfce9"/>
  <text x="64" y="100" font-family="sans-serif" font-size="26" letter-spacing="8" fill="#8fc9b6">SAMADHAN</text>
  <rect x="64" y="132" width="320" height="50" rx="25" fill="#edfce9"/>
  <text x="224" y="166" font-family="sans-serif" font-size="22" letter-spacing="4" fill="#003c33" text-anchor="middle">AFTER · RESOLVED</text>
  <path d="M 980 250 l 70 70 l 150 -150" fill="none" stroke="#edfce9" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" transform="translate(-180 60)"/>
  <text x="62" y="500" font-family="sans-serif" font-weight="700" font-size="96" fill="#ffffff">${esc(name)}</text>
  <rect x="64" y="792" width="1072" height="2" fill="#1d6a5a"/>
  <circle cx="80" cy="846" r="9" fill="#edfce9"/>
  <text x="104" y="856" font-family="sans-serif" font-size="30" fill="#bfe6d6">Verified fixed · before/after confirmed</text>
</svg>`;
}

let n = 0;
for (const c of CATEGORIES) {
  const accent = ACCENT[c.group] ?? ACCENT.other;
  await sharp(Buffer.from(beforeSvg(c.name, accent))).jpeg({ quality: 82 }).toFile(join(outDir, `before-${c.code}.jpg`));
  await sharp(Buffer.from(afterSvg(c.name))).jpeg({ quality: 82 }).toFile(join(outDir, `after-${c.code}.jpg`));
  n += 2;
}
console.log(`generated ${n} demo assets → ${outDir}`);
