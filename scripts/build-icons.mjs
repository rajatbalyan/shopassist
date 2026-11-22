// Generates the ShopAssist app icon, Android adaptive icon layers, splash mark and favicon
// from one SVG brand mark (a shopping bag with an AI "spark").
//
//   node scripts/build-icons.mjs
//
// Writes PNGs to assets/images/ (wired up in app.json). Uses @resvg/resvg-js (dev dependency).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets', 'images');
mkdirSync(out, { recursive: true });

// Brand colors (src/constants/theme.ts: primary light #5B4CF0).
const PRIMARY = '#5B4CF0';
const PRIMARY_DEEP = '#4335D6';
const SPARK = '#FFD58A';

/** The mark on a 1024 canvas: bag body, handle, a spark cut into the bag, a small spark outside. */
function mark({ bag = '#FFFFFF', cut = PRIMARY, accent = SPARK, monochrome = false } = {}) {
  const spark = (cx, cy, r) => {
    const k = r * 0.17; // waist of the 4-point star
    return `M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
  };
  // Bag body: slightly tapered with rounded corners.
  const body = 'M318 404 H706 Q748 404 752 446 L780 776 Q784 828 732 828 H292 Q240 828 244 776 L272 446 Q276 404 318 404 Z';
  const handle = 'M412 420 V352 Q412 252 512 252 Q612 252 612 352 V420';
  const inner = spark(512, 620, 132);
  const outer = spark(782, 268, 64);

  if (monochrome) {
    // Single colour: the spark is a hole in the bag (Android themed icons, notification icon).
    return `
      <path d="${body} ${inner}" fill="${bag}" fill-rule="evenodd"/>
      <path d="${handle}" fill="none" stroke="${bag}" stroke-width="52" stroke-linecap="round"/>
      <path d="${outer}" fill="${bag}"/>`;
  }
  return `
    <path d="${handle}" fill="none" stroke="${bag}" stroke-width="52" stroke-linecap="round"/>
    <path d="${body}" fill="${bag}"/>
    <path d="${inner}" fill="${cut}"/>
    <path d="${outer}" fill="${accent}"/>`;
}

const background = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PRIMARY}"/>
      <stop offset="1" stop-color="${PRIMARY_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>`;

/** Scales content about the centre (adaptive icons keep art inside the middle ~66%). */
const scaled = (content, s) => `<g transform="translate(${512 * (1 - s)} ${512 * (1 - s)}) scale(${s})">${content}</g>`;

const svg = (content) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${content}</svg>`;

function png(name, content, size = 1024) {
  const data = new Resvg(svg(content), { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' })
    .render()
    .asPng();
  writeFileSync(join(out, name), data);
  console.log(`wrote assets/images/${name} (${size}px)`);
}

// iOS / generic icon: full-bleed background (the OS applies the mask).
png('icon.png', background + scaled(mark(), 0.86));
// Android adaptive icon layers.
png('android-icon-background.png', background);
png('android-icon-foreground.png', scaled(mark(), 0.6));
png('android-icon-monochrome.png', scaled(mark({ monochrome: true }), 0.6));
// Splash: white mark on the primary background colour set in app.json.
png('splash-icon.png', mark({ cut: PRIMARY }));
// Web favicon.
png('favicon.png', background + scaled(mark(), 0.9), 48);
// Notification small icon (Android): white silhouette, a little larger than the launcher art.
png('notification-icon.png', scaled(mark({ monochrome: true }), 0.8), 96);
