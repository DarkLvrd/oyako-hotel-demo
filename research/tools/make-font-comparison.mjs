#!/usr/bin/env node
// Build the font-comparison variants of the direction mockups.
//
// Each direction page is copied and its two font families are swapped for the
// candidate pairing, so the only thing that changes between variants is the type.
// Everything else (layout, palette, photography) is byte-identical.
//
// Generated files land in research/fonts/build/ and are committed alongside the
// screenshots they produce. Re-run this instead of editing them by hand.
//
// usage: node make-font-comparison.mjs [--root <hotel-demo dir>]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? def : process.argv[i + 1];
}
const ROOT = resolve(arg('root', join(HERE, '..', '..')));
const OUT = join(ROOT, 'research', 'fonts', 'build');
mkdirSync(OUT, { recursive: true });

// The pairings. Serifs are regular/medium weight only: no hairline display cut,
// and italics either exist as a real face or are switched off rather than faked.
export const PAIRINGS = [
  {
    n: 1,
    slug: 'baskerville-classic',
    label: 'Baskerville classic',
    serif: 'Libre Baskerville',
    sans: 'Inter',
    note: 'Baskerville URW is what The Silo Hotel sets its 86px h1 in.',
  },
  {
    n: 2,
    slug: 'editorial-contrast',
    label: 'Editorial contrast',
    serif: 'Playfair Display',
    sans: 'Source Sans 3',
    note: 'Playfair Display is what The Lagos Continental uses for headings.',
  },
  {
    n: 3,
    slug: 'inscriptional',
    label: 'Inscriptional',
    serif: 'Marcellus',
    sans: 'Work Sans',
    note: 'Roman inscriptional caps, the register of Rosewood and Burj Al Arab.',
    // Marcellus ships a single roman face, so never let the browser synthesise an
    // oblique for it. The selectors must carry a class to outrank the per-direction
    // `.dir-x h1 em` rules, which are otherwise more specific.
    extra: [
      '.dir-a h1 em,.dir-b h1 em,.dir-c h1 em,.dir-a h1 i,.dir-b h1 i,.dir-c h1 i',
      '{font-style:normal}',
    ].join(''),
  },
];

const JOBS = [
  { tpl: 'a-hero.html', out: 'a-hero', full: false },
  { tpl: 'b-hero.html', out: 'b-hero', full: false },
  { tpl: 'c-hero.html', out: 'c-hero', full: false },
  { tpl: 'b-rooms.html', out: 'b-rooms', full: true },
];

const files = [];
for (const p of PAIRINGS) {
  for (const job of JOBS) {
    const src = readFileSync(join(ROOT, 'research', 'directions', job.tpl), 'utf8');
    let html = src
      // the build dir sits one level deeper than research/directions
      .replaceAll('../../assets/', '../../../assets/')
      .replaceAll("'Cormorant Garamond'", `'${p.serif}'`)
      .replaceAll("'Jost'", `'${p.sans}'`);
    if (!html.includes(p.serif)) throw new Error(`no font swap happened in ${job.tpl}`);

    // The serif is pinned to 400 so all three pairings are compared at the same
    // weight the reference hotels use, and any synthesised italic is suppressed.
    const override = [
      '<style>',
      `h1,h2,h3,h1 em,h2 em,h3 em{font-weight:400}`,
      p.extra || '',
      '</style>',
    ].filter(Boolean).join('\n');
    html = html.replace('</head>', `${override}\n</head>`);
    // the shared prelude already declares Cormorant/Jost; add the new faces
    html = html.replace(
      /(<link rel="stylesheet" href="[^"]*fonts\.css">)/,
      `$1\n<link rel="stylesheet" href="../../../assets/fonts/fonts-pairings.css">`,
    );

    const name = `${job.out}-p${p.n}.html`;
    writeFileSync(join(OUT, name), html);
    files.push({ file: name, pairing: p, job });
  }
}
console.log(`wrote ${files.length} variants to ${OUT}`);
