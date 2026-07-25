/**
 * Genere public/og-image.png (1200x630), l'image affichee lors du partage d'un lien du site
 * (Open Graph / Twitter Card). A relancer si l'identite visuelle change :
 *   node scripts/generate-og-image.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'og-image.png');

// Couleurs de la marque (cf. guide UI/UX) : ciel bleu, herbe verte, accent jaune.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4aa3e8"/>
      <stop offset="100%" stop-color="#8fd0f5"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#ciel)"/>

  <!-- nuages -->
  <g fill="#ffffff" opacity="0.85">
    <ellipse cx="180" cy="120" rx="90" ry="42"/>
    <ellipse cx="250" cy="130" rx="70" ry="34"/>
    <ellipse cx="1010" cy="95" rx="80" ry="38"/>
    <ellipse cx="1080" cy="108" rx="60" ry="30"/>
  </g>

  <!-- herbe -->
  <path d="M0 470 Q 300 430 600 470 T 1200 460 L1200 630 L0 630 Z" fill="#5fb24a"/>
  <path d="M0 520 Q 300 486 600 520 T 1200 512 L1200 630 L0 630 Z" fill="#4e9a3c"/>

  <!-- carte creme -->
  <rect x="90" y="150" width="1020" height="300" rx="28" fill="#f7f3d7" stroke="#3f5d1d" stroke-width="8"/>

  <text x="600" y="268" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="82" font-weight="800" fill="#3b4cca">Poké-Idle</text>
  <text x="600" y="330" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="34" font-weight="600" fill="#2b2a24">Mini-jeux Pokémon quotidiens et gratuits</text>
  <text x="600" y="392" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
        font-size="27" font-weight="500" fill="#6f6a52">Silhouette · Motus · Shiny · Duel 1 contre 1</text>

  <!-- pokeball stylisee -->
  <g transform="translate(600 470)">
    <circle r="46" fill="#ffffff" stroke="#2b2a24" stroke-width="7"/>
    <path d="M-46 0 A46 46 0 0 1 46 0 Z" fill="#ee1515" stroke="#2b2a24" stroke-width="7"/>
    <line x1="-46" y1="0" x2="46" y2="0" stroke="#2b2a24" stroke-width="9"/>
    <circle r="15" fill="#ffffff" stroke="#2b2a24" stroke-width="7"/>
  </g>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(out, png);
console.log(`og-image.png genere (${(png.length / 1024).toFixed(0)} ko) -> ${out}`);
