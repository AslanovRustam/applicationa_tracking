// One-off generator for PWA icons: node scripts/make-icons.mjs
import sharp from 'sharp';

const svg = (size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${pad ? 0 : 22}" fill="#2563eb"/>
  <circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-width="7"/>
  <circle cx="50" cy="50" r="15" fill="none" stroke="#fff" stroke-width="7"/>
  <circle cx="50" cy="50" r="4" fill="#fff"/>
</svg>`;

for (const [file, size, full] of [
  ['public/icon-192.png', 192, false],
  ['public/icon-512.png', 512, false],
  ['public/apple-touch-icon.png', 180, true],
]) {
  await sharp(Buffer.from(svg(size, full))).png().toFile(file);
  console.log('wrote', file);
}
