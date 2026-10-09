#!/usr/bin/env node
// Proof screenshots for the Oyako Hotel demo.
//
// Chrome's `captureBeyondViewport` produces a corrupted composite on very tall
// pages — the tail of a 17 000 px phone page comes back showing the hero again —
// so this tool scrolls the page and captures the real viewport at each step,
// then stitches the chunks (tools/stitch-proof.py).
//
// For the stitched full-page shot it neutralises position:sticky, position:fixed
// and the scroll-reveal transitions, so the result reads as one long document
// instead of repeating the header in every chunk. Section shots leave the page
// exactly as a visitor sees it, sticky header and floating button included.
//
// usage:
//   node capture-proof.mjs --mode fullpage --url <url> --out <dir> --prefix desktop-1440 \
//        [--w 1440] [--h 900] [--mobile] [--dpr 1]
//   node capture-proof.mjs --mode sections --url <url> --out <dir> --prefix desktop-1440 \
//        --sections '#stay,#rooms,#dining' [--w 1440] [--h 900] [--mobile] [--dpr 1]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith('--')) return true;
  return next;
}
const flag = (n) => process.argv.includes('--' + n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const URL_ = arg('url');
const MODE = arg('mode', 'fullpage');
const OUT = arg('out');
const PREFIX = arg('prefix', 'shot');
const W = parseInt(arg('w', '1440'), 10);
const H = parseInt(arg('h', '900'), 10);
const MOBILE = flag('mobile');
const DPR = parseFloat(arg('dpr', MOBILE ? '2' : '1'));
const WAIT = parseInt(arg('wait', '2500'), 10);
const SECTIONS = String(arg('sections', '')).split(',').map((s) => s.trim()).filter(Boolean);

if (!URL_ || !OUT) {
  console.error('need --url and --out');
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const PORT = 9700 + Math.floor(Math.random() * 400);
const profile = `${tmpdir()}/fm-proof-${PORT}-${Date.now()}`;
const UA_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1';

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-background-networking', '--disable-sync', '--hide-scrollbars',
  '--mute-audio', '--force-device-scale-factor=' + DPR,
  `--window-size=${W},${H}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] });

function kill() {
  try { chrome.kill('SIGKILL'); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
process.on('exit', kill);

let version = null;
for (let i = 0; i < 100; i++) {
  try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
  catch { await sleep(150); }
}
if (!version) { console.error('chrome never came up'); process.exit(3); }

const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map(); const listeners = new Map();
ws.onmessage = (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(m.error.message)) : res(m.result); return;
  }
  for (const fn of listeners.get(m.method) || []) fn(m.params);
};
function send(method, params = {}, sessionId) {
  const id = ++seq;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); } }, 90000);
  });
}
function once(method, sid) {
  return new Promise((res) => {
    const fn = (p) => { listeners.set(method, (listeners.get(method) || []).filter((f) => f !== fn)); res(p); };
    listeners.set(method, [...(listeners.get(method) || []), fn]);
  });
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, S);
await send('Runtime.enable', {}, S);
await send('Emulation.setDeviceMetricsOverride', {
  width: W, height: H, deviceScaleFactor: DPR, mobile: MOBILE, screenWidth: W, screenHeight: H,
}, S);
await send('Emulation.setUserAgentOverride', {
  userAgent: MOBILE ? UA_MOBILE : UA_DESKTOP,
  acceptLanguage: 'en-US,en;q=0.9',
  platform: MOBILE ? 'iPhone' : 'MacIntel',
}, S);
await send('Page.navigate', { url: URL_ }, S);
await Promise.race([once('Page.loadEventFired', S), sleep(30000)]);
await sleep(WAIT);

// Wait for every image to have decoded, and for the fonts to be ready.
await send('Runtime.evaluate', {
  expression: `(async () => {
    await Promise.all(Array.from(document.images).filter(i => !i.complete)
      .map(i => new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 8000); })));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    return 1;
  })()`,
  awaitPromise: true, timeout: 120000,
}, S).catch(() => {});

async function shot(expression, out) {
  const r = await send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: false }, S);
  writeFileSync(out, Buffer.from(r.data, 'base64'));
  return out;
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, S);
  return r.result ? r.result.value : undefined;
}

if (MODE === 'fullpage') {
  // One long document: no repeating sticky header, no half-faded reveals.
  await evaluate(`(() => {
    const s = document.createElement('style');
    s.id = 'proof-capture';
    s.textContent = [
      'html{scroll-behavior:auto !important}',
      '.site-header{position:static !important}',
      '.wa-fab{display:none !important}',
      '.reveal{opacity:1 !important;transform:none !important;transition:none !important}',
      'dialog{display:none !important}'
    ].join('\\n');
    document.head.appendChild(s);
    window.scrollTo(0, 0);
    return 1;
  })()`);
  await sleep(700);

  const total = await evaluate('Math.ceil(document.documentElement.scrollHeight)');
  const chunks = [];
  let target = 0;
  let guard = 0;
  while (target < total && guard++ < 400) {
    const y = await evaluate(`(() => { window.scrollTo(0, ${target}); return window.scrollY; })()`);
    await sleep(320);
    const file = join(OUT, `${PREFIX}--chunk-${String(chunks.length).padStart(3, '0')}.png`);
    await shot(null, file);
    chunks.push({ file, y: Math.round(y) });
    if (y + H >= total) break;
    target = y + H;
  }
  const manifest = join(OUT, `${PREFIX}--chunks.json`);
  writeFileSync(manifest, JSON.stringify({ width: W, height: total, viewportH: H, dpr: DPR, chunks }, null, 1));
  console.log(JSON.stringify({ ok: true, mode: 'fullpage', total, chunks: chunks.length, manifest }));
} else if (MODE === 'sections') {
  // Exactly what a visitor sees, sticky header and all.
  const done = [];
  for (const sel of SECTIONS) {
    const info = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return null;
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), h: Math.round(r.height), y: Math.round(window.scrollY) };
    })()`);
    if (!info) { console.error('missing section ' + sel); continue; }
    await sleep(650);
    const name = sel.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'section';
    const file = join(OUT, `${PREFIX}--${name}.png`);
    await shot(null, file);
    done.push({ sel, file, ...info });
    console.log(`${sel} y=${info.y} h=${info.h} -> ${file}`);
  }
  writeFileSync(join(OUT, `${PREFIX}--sections.json`), JSON.stringify({ width: W, height: H, dpr: DPR, sections: done }, null, 1));
  console.log(JSON.stringify({ ok: true, mode: 'sections', count: done.length }));
} else {
  console.error('unknown --mode ' + MODE);
  process.exit(2);
}

kill();
process.exit(0);
