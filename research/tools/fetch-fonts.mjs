#!/usr/bin/env node
// Download the latin subsets of the candidate font pairings into assets/fonts/ and
// write the @font-face stylesheet that declares them. Everything is bundled so the
// site and the single-file export render with no network connection.
//
// usage: node fetch-fonts.mjs [--out <assets/fonts dir>]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  return process.argv[i + 1];
}
const OUT = arg('out', new URL('../../assets/fonts/', import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';

// The three candidate pairings. Each family is SIL Open Font License 1.1 and served
// by Google Fonts. Serifs are regular/medium weight only - no hairline display cut.
const FAMILIES = [
  { file: 'libre-baskerville', css: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap' },
  { file: 'inter', css: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap' },
  { file: 'playfair-display', css: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap' },
  { file: 'source-sans-3', css: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500&display=swap' },
  { file: 'marcellus', css: 'https://fonts.googleapis.com/css2?family=Marcellus&display=swap' },
  { file: 'work-sans', css: 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500&display=swap' },
];

const out = [];
for (const fam of FAMILIES) {
  const css = execFileSync('curl', ['-sSL', '--max-time', '40', '-A', UA, fam.css]).toString();
  // Google emits "/* subset */ @font-face {...}" pairs; the comment names the subset.
  const pairs = [...css.matchAll(/\/\*\s*([a-z0-9-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)]
    .map((m) => ({ subset: m[1], body: m[2] }));
  for (const p of pairs.filter((x) => x.subset === 'latin')) {
    const style = (/font-style:\s*(\w+)/.exec(p.body) || [, 'normal'])[1];
    const weight = (/font-weight:\s*([\d ]+)/.exec(p.body) || [, '400'])[1].trim().replace(/\s+/g, '-');
    const url = /url\((https:[^)]+\.woff2)\)/.exec(p.body)[1];
    const name = `${fam.file}-${weight}${style === 'italic' ? '-italic' : ''}.woff2`;
    execFileSync('curl', ['-sSL', '--max-time', '60', '-A', UA, '-o', join(OUT, name), url]);
    const body = p.body
      .replace(/url\(https:[^)]+\.woff2\)/, `url('${name}')`)
      .replace(/\s+/g, ' ')
      .trim();
    out.push(body);
    console.log(`${name}  ${(readFileSync(join(OUT, name)).length / 1024).toFixed(1)}KB`);
  }
}
const header = [
  '/* Candidate font pairings, bundled locally so every page renders offline.',
  '   All families are SIL Open Font License 1.1 via Google Fonts.',
  '   Licences and sources: assets/CREDITS.md */',
];
writeFileSync(join(OUT, 'fonts-pairings.css'), header.concat(out).join('\n') + '\n');
console.log(`\n${out.length} latin faces -> ${join(OUT, 'fonts-pairings.css')}`);
