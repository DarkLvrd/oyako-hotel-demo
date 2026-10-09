#!/usr/bin/env node
/* ============================================================================
 * Build deploy/ — a self-contained static folder ready to upload as-is.
 *
 * It copies the site's editable source (index.html, site.config.js, app.js,
 * styles.css) plus only the images and fonts those files actually reference,
 * adds `<meta name="robots" content="noindex">`, robots.txt and a _headers
 * file that discourages indexing, and then proves that every reference is
 * relative: no leading "/", no file:// URLs. The result works from a domain
 * root, from a subfolder, or from any static host.
 *
 * This is the MAIN SITE only. The presentation showcase (showcase.html) is
 * deliberately not part of what gets hosted — it lives in the project source
 * and in dist/, not in deploy/.
 *
 * Re-badge for another hotel by editing site.config.js (and swapping images
 * under assets/img/), then run this again.
 *
 * Node built-ins only.
 *
 *   node tools/build-deploy.mjs [--out deploy] [--quiet]
 * ==========================================================================*/
import {
  readFileSync, writeFileSync, mkdirSync, rmSync, statSync,
  readdirSync, existsSync, copyFileSync,
} from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');                    // clients/hotel-demo
const argv = process.argv.slice(2);
const QUIET = argv.includes('--quiet');
const outIdx = argv.indexOf('--out');
const DEPLOY = join(ROOT, outIdx === -1 ? 'deploy' : argv[outIdx + 1]);

// the pages that make up the deployable site, and the support files they load
const PAGES = ['index.html'];
const SUPPORT = ['site.config.js', 'app.js', 'styles.css'];
const TEXT = ['html', 'css', 'js'];

const NOINDEX = '<meta name="robots" content="noindex">';

const ROBOTS = `# Oyako Hotel pitch demo — a private presentation, not a public site.
User-agent: *
Disallow: /
`;

// Netlify and Cloudflare Pages read this; harmless elsewhere.
const HEADERS = `/*
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: no-referrer
`;

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const size = (p) => statSync(p).size;
const human = (bytes) => bytes < 1024 * 1024
  ? (bytes / 1024).toFixed(0) + ' KB'
  : (bytes / 1024 / 1024).toFixed(2) + ' MB';

/* 1. Collect every local asset the site references. */
const sources = [...PAGES, ...SUPPORT];
const blob = sources.map(read).join('\n');
const assets = [...new Set(
  (blob.match(/assets\/[A-Za-z0-9._/-]+\.[A-Za-z0-9]+/g) || []),
)].sort();

const missing = assets.filter((p) => !existsSync(join(ROOT, p)));
if (missing.length) {
  console.error('referenced assets that do not exist:\n  ' + missing.join('\n  '));
  process.exit(1);
}

/* 2. Rebuild deploy/ from scratch so a stale file can never survive a rebuild. */
rmSync(DEPLOY, { recursive: true, force: true });
mkdirSync(DEPLOY, { recursive: true });

let copied = 0;
let bytes = 0;
function put(rel, contents) {
  const dest = join(DEPLOY, rel);
  mkdirSync(dirname(dest), { recursive: true });
  if (typeof contents === 'string') writeFileSync(dest, contents);
  else { copyFileSync(contents.from, dest); bytes += size(contents.from); }
  copied++;
}

/* 3. Pages: copy with a noindex meta added (the source stays clean). */
for (const page of PAGES) {
  let html = read(page);
  if (!/name="robots"/.test(html)) {
    if (!html.includes('<head>')) throw new Error(page + ' has no <head> to add noindex to');
    html = html.replace('<head>', '<head>\n' + NOINDEX);
  }
  put(page, html);
}
for (const file of SUPPORT) put(file, { from: join(ROOT, file) });
for (const asset of assets) put(asset, { from: join(ROOT, asset) });
/* Responsive images: app.js points a phone at assets/img/small/<name>, the
 * 900-px variant of the full-size photograph, through srcset. Copy those too so
 * the hosted site stays complete. If one is missing the site still works - it
 * falls back to the full-size file - so this warns rather than fails. */
const smallVariants = assets
  .filter((p) => /^assets\/img\/[^/]+\.(jpe?g|png|webp)$/i.test(p))
  .map((p) => p.replace(/^assets\/img\//, 'assets/img/small/'));
const missingSmall = smallVariants.filter((p) => !existsSync(join(ROOT, p)));
for (const p of smallVariants) {
  if (existsSync(join(ROOT, p))) put(p, { from: join(ROOT, p) });
}
if (existsSync(join(ROOT, 'assets/CREDITS.md'))) {
  put('assets/CREDITS.md', { from: join(ROOT, 'assets/CREDITS.md') });
}
put('robots.txt', ROBOTS);
put('_headers', HEADERS);

/* 4. Prove the folder is portable: every reference must be relative. */
const textFiles = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (TEXT.includes(extname(name).slice(1).toLowerCase())) textFiles.push(full);
  }
})(DEPLOY);

const offenders = [];
for (const file of textFiles) {
  const text = readFileSync(file, 'utf8');
  const rules = [
    [/(?:src|href)\s*=\s*["']\//, 'absolute src/href'],
    [/url\(\s*["']?\//, 'absolute CSS url()'],
    [/file:\/\//, 'file:// URL'],
  ];
  for (const [re, why] of rules) {
    const m = text.match(re);
    if (m) offenders.push(`${relative(DEPLOY, file)}: ${why} (${m[0].trim()})`);
  }
}
if (offenders.length) {
  console.error('deploy/ is not portable:\n  ' + offenders.join('\n  '));
  process.exit(1);
}

/* 5. Report. */
function dirSize(dir) {
  let sum = 0;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    sum += statSync(full).isDirectory() ? dirSize(full) : size(full);
  }
  return sum;
}
const total = dirSize(DEPLOY);

if (!QUIET) {
  console.log(`deploy/  ${copied} files, ${human(total)} total`);
  for (const name of readdirSync(DEPLOY)) {
    const full = join(DEPLOY, name);
    console.log(`  ${name.padEnd(14)} ${human(statSync(full).isDirectory() ? dirSize(full) : size(full))}`);
  }
  console.log(`  every reference is relative; noindex meta, robots.txt and _headers written`);
  if (missingSmall.length) {
    console.log(`  NOTE ${missingSmall.length} image(s) have no 900-px variant in assets/img/small/`);
    console.log('       (phones will fall back to the full-size file):');
    for (const p of missingSmall.slice(0, 6)) console.log('       ' + p);
    console.log('       generate them with: sh tools/make-image-variants.sh');
  } else if (smallVariants.length) {
    console.log(`  ${smallVariants.length} responsive 900-px image variants copied`);
  }
}
