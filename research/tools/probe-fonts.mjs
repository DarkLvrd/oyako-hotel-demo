#!/usr/bin/env node
// Report the typefaces a page actually renders with: computed font-family stacks for
// headings / body / nav, plus every @font-face family it declares.
// usage: node probe-fonts.mjs --url <url>
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith('--')) return true;
  return next;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = arg('url');
const W = parseInt(arg('w', '1440'), 10);
const H = parseInt(arg('h', '900'), 10);
const WAIT = parseInt(arg('wait', '5000'), 10);

const PORT = 9300 + Math.floor(Math.random() * 400);
const profile = `${tmpdir()}/fm-fonts-${PORT}-${Date.now()}`;
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-background-networking', '--hide-scrollbars', '--mute-audio',
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
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); } }, 60000);
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
await send('Emulation.setDeviceMetricsOverride',
  { width: W, height: H, deviceScaleFactor: 1, mobile: false, screenWidth: W, screenHeight: H }, S);
await send('Page.navigate', { url }, S);
await Promise.race([once('Page.loadEventFired', S), sleep(25000)]);
await sleep(WAIT);

const expr = `(() => {
  const faces = [];
  for (const ss of document.styleSheets) {
    let rules; try { rules = ss.cssRules; } catch { continue; }
    if (!rules) continue;
    for (const r of rules) {
      if (r.constructor && r.constructor.name === 'CSSFontFaceRule') {
        const fam = (r.style.getPropertyValue('font-family') || '').replace(/["']/g, '').trim();
        const src = (r.style.getPropertyValue('src') || '');
        const host = (src.match(/https?:\\/\\/([^\\/)]+)/) || [])[1] || 'local';
        if (fam) faces.push(fam + ' @' + host);
      }
    }
  }
  const seen = new Map();
  const pick = (sel) => {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const cs = getComputedStyle(el);
      const key = sel + '::' + cs.fontFamily;
      if (!seen.has(key)) {
        seen.set(key, true);
        return el.tagName.toLowerCase() + ' "' + (el.textContent || '').trim().slice(0, 28) + '" -> '
          + cs.fontFamily + ' | ' + cs.fontWeight + ' ' + cs.fontSize + ' ls ' + cs.letterSpacing;
      }
    }
    return null;
  };
  const out = [];
  for (const [label, sel] of [['H1', 'h1'], ['H2', 'h2,h3'], ['BODY', 'p,li,span'],
                              ['LINK/BTN', 'a,button']]) {
    const v = pick(sel);
    if (v) out.push(label + ': ' + v);
  }
  // prove the intended face is really available, not silently falling back
  const checks = [];
  for (const sel of ['h1', 'p']) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const cs = getComputedStyle(el);
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const spec = cs.fontWeight + ' ' + cs.fontSize + ' "' + fam + '"';
    checks.push(sel + ' ' + fam + ' loaded=' + document.fonts.check(spec));
    const em = document.querySelector(sel + ' em');
    if (em) checks.push(sel + ' em font-style=' + getComputedStyle(em).fontStyle);
  }
  return JSON.stringify({ faces: [...new Set(faces)].slice(0, 14), roles: out, checks });
})()`;
const out = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, S);
const r = JSON.parse(out.result.value);
console.log('== ' + url);
console.log('  @font-face: ' + (r.faces.join(', ') || '(none declared in CSSOM)'));
for (const line of r.roles) console.log('  ' + line);
console.log('  CHECK: ' + r.checks.join(' | '));
kill();
process.exit(0);
