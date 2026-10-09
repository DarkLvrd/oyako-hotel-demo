#!/usr/bin/env node
/* ============================================================================
 * Build dist/oyako-hotel-showcase.html — the presentation showcase as one file.
 *
 * The showcase page on its own is a couple of KB; the size is the site it
 * frames. So the already-inlined site (dist/oyako-hotel.html) is embedded
 * exactly ONCE, as a single JavaScript string, and both frames are filled from
 * it at runtime via iframe.srcdoc.
 *
 * Run export-single.mjs first: this reads its output.
 *
 * Node built-ins only.
 *
 *   node export-showcase.mjs [--out dist/oyako-hotel-showcase.html] [--quiet]
 * ==========================================================================*/
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const QUIET = process.argv.includes('--quiet');
const outIdx = process.argv.indexOf('--out');
const OUT = join(ROOT, outIdx === -1 ? 'dist/oyako-hotel-showcase.html' : process.argv[outIdx + 1]);
const SITE = join(ROOT, 'dist', 'oyako-hotel.html');

const MIME = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.jpg': 'image/jpeg', '.png': 'image/png' };
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const dataUri = (p) => {
  const mime = MIME[extname(p).toLowerCase()];
  if (!mime) throw new Error(`no MIME type for ${p}`);
  return `data:${mime};base64,${readFileSync(join(ROOT, p)).toString('base64')}`;
};

/* A JavaScript string literal that is safe inside a <script> block.
 * JSON.stringify alone is not enough: a literal "</script" would end the block
 * early, and "<!--" can put the HTML tokenizer into an escaped state that then
 * ignores the real terminator. Escaping every "<" as \u003c removes both
 * hazards, and non-ASCII is escaped so the file stays plain ASCII. */
function jsString(s) {
  return JSON.stringify(s)
    .replace(/</g, '\\u003c')
    .replace(/[\u007f-\uffff]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
}

let siteHtml;
try {
  siteHtml = readFileSync(SITE, 'utf8');
} catch {
  console.error(`missing dist/oyako-hotel.html — run: node export-single.mjs`);
  process.exit(1);
}

/* ---------------------------------------------------------------- 1. assets
 * Taken from the pristine showcase source and inlined BEFORE anything else is
 * injected. Doing this the other way round rewrote the image paths inside the
 * embedded settings file into data URIs, which silently added a second ~11 MB
 * copy of every photograph to the output. */
let html = read('showcase.html');
const ownAssets = [...new Set((html.match(/assets\/[A-Za-z0-9._/-]+\.[A-Za-z0-9]+/g) || []))].sort();
const missing = ownAssets.filter((p) => {
  try { statSync(join(ROOT, p)); return false; } catch { return true; }
});
if (missing.length) {
  console.error('referenced assets that do not exist:\n  ' + missing.join('\n  '));
  process.exit(1);
}
for (const asset of ownAssets) {
  html = html.split(asset).join(dataUri(asset));
}

/* ------------------------------------------------- 2. the showcase's settings
 * Only the fields the presentation chrome actually reads. The whole settings
 * file would drag in every room, review and photograph path, none of which the
 * showcase uses. */
let configJs;
try {
  const sandbox = {};
  new Function('window', read('site.config.js'))(sandbox);
  const cfg = sandbox.OYAKO;
  configJs = 'window.OYAKO = ' + JSON.stringify({
    meta: { demoNotice: cfg.meta && cfg.meta.demoNotice },
    brand: cfg.brand,
    // brand.markSvg is inline SVG markup, so it must survive as a string
    theme: cfg.theme,
  }) + ';';
} catch (err) {
  console.error('could not read site.config.js, falling back to inlining it whole: ' + err.message);
  configJs = read('site.config.js');
}
configJs = configJs.replace(/<\/script>/gi, '<\\/script>');

const cfgTag = '<script src="site.config.js"></script>';
if (!html.includes(cfgTag)) throw new Error('could not find the site.config.js tag');
html = html.replace(cfgTag, () =>
  `<script>\n${configJs}\n</script>\n\n` +
  `<!-- The whole site, embedded once; both frames load it from this string. -->\n` +
  `<script>window.OYAKO_SITE_HTML = ${jsString(siteHtml)};</script>`);

/* ------------------------------------------------------- 3. nothing external
 * Only real paths count: the embedded site contains markup templates such as
 * src="' + esc(x) + '", and every photograph in it is already a data URI. */
const leftovers = [...new Set(
  (html.match(/(?:src|href)="[^">'+]+\.(?:jpg|jpeg|png|webp|svg|woff2?|css|js)"/g) || []),
)];
if (leftovers.length) {
  console.error('still references local files after inlining:\n  ' + leftovers.join('\n  '));
  process.exit(1);
}
/* A real reference, not prose: app.js mentions assets/img/small/ in a comment. */
if (/["'(]assets\/img\//.test(html)) {
  console.error('the output still mentions assets/img/ — the photographs should be data URIs');
  process.exit(1);
}

html = html.replace(
  '<head>',
  () => '<head>\n<!-- Generated by export-showcase.mjs — do not edit. ' +
    'The editable source is showcase.html. -->',
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);

if (!QUIET) {
  const size = statSync(OUT).size;
  const siteSize = statSync(SITE).size;
  console.log(
    `dist/oyako-hotel-showcase.html  ${(size / 1024 / 1024).toFixed(2)} MB\n` +
    `  site embedded once (${(siteSize / 1024 / 1024).toFixed(2)} MB), ` +
    `${ownAssets.length} showcase assets inlined, trimmed settings file\n` +
    `  a second copy of the site would have added about ` +
    `${(siteSize / 1024 / 1024).toFixed(2)} MB\n` +
    `  no external references remain`,
  );
}
