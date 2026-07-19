/**
 * generate-icons.mjs
 * Generates PWA icon PNGs using only Node.js built-ins (no extra deps).
 * Creates solid-color placeholder icons in public/icons/.
 * Replace with proper branded artwork before shipping to production.
 *
 * Usage:  node scripts/generate-icons.mjs
 */

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, '..', 'public', 'icons');

// ─── CRC-32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xff];
  return ((crc ^ 0xffffffff) >>> 0);
}

// ─── PNG chunk helper ────────────────────────────────────────────────────────
function chunk(type, data) {
  const typeB  = Buffer.from(type, 'ascii');
  const lenB   = Buffer.alloc(4); lenB.writeUInt32BE(data.length);
  const crcB   = Buffer.alloc(4); crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([lenB, typeB, data, crcB]);
}

// ─── Build a square solid-colour RGBA PNG ────────────────────────────────────
function buildPNG(size, r, g, b, a = 255) {
  // Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, bit-depth=8, colour-type=6 (RGBA), compress=0, filter=0, interlace=0
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA

  // Raw image: one filter byte (0 = None) + 4 bytes per pixel per row
  const rowLen = 1 + size * 4;
  const raw    = Buffer.alloc(size * rowLen);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const o = y * rowLen + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Icon specs ──────────────────────────────────────────────────────────────
// Brand blue: #2563EB → rgb(37, 99, 235)
const [R, G, B] = [37, 99, 235];

const ICONS = [
  // Standard
  { file: 'icon-16.png',             size: 16  },
  { file: 'icon-32.png',             size: 32  },
  { file: 'icon-192.png',            size: 192 },
  { file: 'icon-512.png',            size: 512 },
  // Maskable (identical colour, purpose="maskable" declared in manifest)
  { file: 'icon-maskable-192.png',   size: 192 },
  { file: 'icon-maskable-512.png',   size: 512 },
  // Apple touch icon (180×180 recommended)
  { file: 'apple-touch-icon.png',    size: 180 },
];

// ─── Generate ────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });

for (const { file, size } of ICONS) {
  const png = buildPNG(size, R, G, B);
  writeFileSync(join(OUT_DIR, file), png);
  console.log(`✅  ${file.padEnd(28)} ${size}×${size} px  (${png.length} bytes)`);
}

console.log(`\n🎉  All icons written to public/icons/`);
console.log(`💡  Replace with proper branded artwork before shipping to production.`);
