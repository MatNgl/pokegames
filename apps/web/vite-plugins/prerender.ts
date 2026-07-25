import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import {
  INDEXABLE_ROUTES,
  ROUTES_META,
  SITE_NAME,
  SITE_URL,
  buildJsonLd,
  type RouteMeta,
} from '../src/lib/seo/site-meta.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Balises de tete d'une route. Ecrites en dur dans le HTML : c'est la seule version que voient les
 * crawlers qui n'executent pas JavaScript (dont la plupart des robots IA).
 */
function headTags(meta: RouteMeta): string {
  const url = `${SITE_URL}${meta.path}`;
  const image = `${SITE_URL}/og-image.png`;
  const d = escapeHtml(meta.description);
  const t = escapeHtml(meta.title);
  // data-prerendered : ces balises sont retirees au demarrage de l'app (main.tsx), sinon React 19
  // ajouterait les siennes en plus et on se retrouverait avec des canonical/description en double.
  const p = 'data-prerendered=""';
  const tags = [
    `<title>${t}</title>`,
    `<meta ${p} name="description" content="${d}" />`,
    `<link ${p} rel="canonical" href="${url}" />`,
    meta.indexable
      ? `<meta ${p} name="robots" content="index, follow, max-image-preview:large" />`
      : `<meta ${p} name="robots" content="noindex, follow" />`,
    `<meta ${p} property="og:type" content="website" />`,
    `<meta ${p} property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta ${p} property="og:locale" content="fr_FR" />`,
    `<meta ${p} property="og:title" content="${t}" />`,
    `<meta ${p} property="og:description" content="${d}" />`,
    `<meta ${p} property="og:url" content="${url}" />`,
    `<meta ${p} property="og:image" content="${image}" />`,
    `<meta ${p} name="twitter:card" content="summary_large_image" />`,
    `<meta ${p} name="twitter:title" content="${t}" />`,
    `<meta ${p} name="twitter:description" content="${d}" />`,
    `<meta ${p} name="twitter:image" content="${image}" />`,
  ];
  if (meta.path === '/') {
    tags.push(
      `<script ${p} type="application/ld+json">${JSON.stringify(buildJsonLd())}</script>`,
    );
  }
  return tags.join('\n    ');
}

/**
 * Contenu textuel reel injecte dans #root. React le remplace au montage (createRoot vide le
 * conteneur), mais il existe dans le HTML servi : c'est ce que lisent les moteurs et les IA.
 * Styles en ligne volontaires : ces classes ne passent pas par le scan Tailwind.
 */
function bodyContent(meta: RouteMeta): string {
  const links = INDEXABLE_ROUTES.filter((r) => r.path !== meta.path)
    .map((r) => `<li><a href="${r.path}" style="color:#3b4cca">${escapeHtml(r.h1)}</a></li>`)
    .join('');
  const rules = meta.rules?.length
    ? `<h2 style="font-size:1.1rem;margin:1.5rem 0 .5rem">Règles du jeu</h2><ul>${meta.rules
        .map((r) => `<li>${escapeHtml(r)}</li>`)
        .join('')}</ul>`
    : '';

  return `<div style="max-width:52rem;margin:0 auto;padding:2rem 1rem;font-family:system-ui,sans-serif;color:#2b2a24;line-height:1.6">
      <h1 style="font-size:1.6rem;margin:0 0 .75rem">${escapeHtml(meta.h1)}</h1>
      <p>${escapeHtml(meta.intro)}</p>
      ${rules}
      <h2 style="font-size:1.1rem;margin:1.5rem 0 .5rem">Les autres jeux</h2>
      <ul>${links}</ul>
    </div>`;
}

function sitemap(): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = INDEXABLE_ROUTES.map(
    (r) => `  <url>
    <loc>${SITE_URL}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${r.path === '/' ? '1.0' : '0.8'}</priority>
  </url>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function robots(): string {
  const disallow = ROUTES_META.filter((r) => !r.indexable)
    .map((r) => `Disallow: ${r.path}`)
    .join('\n');
  return `User-agent: *
Allow: /
${disallow}

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

/**
 * Prerendu statique des routes publiques + sitemap.xml + robots.txt.
 *
 * Une SPA Vite ne sert qu'un index.html vide : sans ce prerendu, un crawler qui n'execute pas JS
 * ne voit ni titre, ni description, ni contenu. On ecrit donc un fichier HTML par route, avec ses
 * metadonnees et son contenu textuel. Cote serveur, la regle SPA habituelle
 * (try_files $uri $uri/ /index.html) sert automatiquement dist/<route>/index.html quand il existe.
 */
export function prerenderPlugin(): Plugin {
  return {
    name: 'pokegames-prerender',
    apply: 'build',
    closeBundle() {
      const outDir = join(process.cwd(), 'dist');
      const template = readFileSync(join(outDir, 'index.html'), 'utf-8');

      for (const meta of ROUTES_META) {
        let html = template;

        // Remplace le <title> du gabarit puis injecte le reste des balises avant </head>.
        html = html.replace(/<title>[\s\S]*?<\/title>/, '');
        html = html.replace('</head>', `  ${headTags(meta)}\n  </head>`);
        html = html.replace(
          /<div id="root"><\/div>/,
          `<div id="root">${bodyContent(meta)}</div>`,
        );

        const target =
          meta.path === '/'
            ? join(outDir, 'index.html')
            : join(outDir, meta.path.replace(/^\//, ''), 'index.html');
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, html, 'utf-8');
      }

      writeFileSync(join(outDir, 'sitemap.xml'), sitemap(), 'utf-8');
      writeFileSync(join(outDir, 'robots.txt'), robots(), 'utf-8');

      this.info?.(
        `prerendu : ${ROUTES_META.length} routes, sitemap (${INDEXABLE_ROUTES.length} URLs) et robots.txt generes`,
      );
    },
  };
}
