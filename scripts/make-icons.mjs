// Erzeugt public/icons/icon-192.png und icon-512.png ohne Abhängigkeiten
// (eigener PNG-Encoder: RGBA, zlib). Motiv: dunkler Kreis mit grünem Ring und
// Tennisball-Naht — bewusst schlicht, damit es als Maskable-Icon funktioniert.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c,
    crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function draw(size) {
  const c = size / 2;
  const BG = [11, 18, 32];
  const GREEN = [163, 230, 53]; // lime-400
  const WHITE = [241, 245, 249];
  return (x, y) => {
    const dx = x - c + 0.5,
      dy = y - c + 0.5;
    const d = Math.hypot(dx, dy) / size; // 0..0.5
    // Ball
    if (d < 0.31) {
      // Naht: zwei Bögen
      const s1 = Math.hypot(dx - size * 0.22, dy) / size;
      const s2 = Math.hypot(dx + size * 0.22, dy) / size;
      if (Math.abs(s1 - 0.3) < 0.018 || Math.abs(s2 - 0.3) < 0.018) return [...WHITE, 255];
      return [...GREEN, 255];
    }
    return [...BG, 255];
  };
}

mkdirSync("public/icons", { recursive: true });
for (const s of [192, 512]) {
  writeFileSync(`public/icons/icon-${s}.png`, png(s, draw(s)));
  console.log(`icon-${s}.png`);
}
