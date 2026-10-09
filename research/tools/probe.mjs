#!/usr/bin/env node
// Dependency-free layout probe: opens a page in our own headless Google Chrome
// and reports document/scroll widths plus any element wider than the viewport.
// usage: node probe.mjs --url <url> --w 390 [--h 844] [--mobile] [--wait 2500]
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
const flag = (n) => process.argv.includes('--' + n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const url = arg('url');
const W = parseInt(arg('w', '390'), 10);
const H = parseInt(arg('h', '844'), 10);
const MOBILE = flag('mobile');
const WAIT = parseInt(arg('wait', '2500'), 10);

const PORT = 9900 + Math.floor(Math.random() * 400);
const profile = `${tmpdir()}/fm-probe-${PORT}-${Date.now()}`;
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
  { width: W, height: H, deviceScaleFactor: 1, mobile: MOBILE, screenWidth: W, screenHeight: H }, S);
await send('Page.navigate', { url }, S);
await Promise.race([once('Page.loadEventFired', S), sleep(20000)]);
await sleep(WAIT);

const expr = `(() => {
  const vw = document.documentElement.clientWidth;
  const docW = document.documentElement.scrollWidth;
  const bodyW = document.body.scrollWidth;
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'absolute') continue;
      bad.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 40),
                 left: Math.round(r.left), right: Math.round(r.right) });
    }
  }
  return JSON.stringify({ vw, docW, bodyW, sh: document.documentElement.scrollHeight, bh: document.body.scrollHeight, overflow: docW > vw, count: bad.length, bad: bad.slice(0, 8) });
})()`;
const out = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, S);
const r = JSON.parse(out.result.value);
console.log(`${url} @${W}  vw=${r.vw} doc=${r.docW} body=${r.bodyW} scrollH=${r.sh}/${r.bh} overflow=${r.overflow}` +
  (r.bad.length ? `\n  offenders: ${JSON.stringify(r.bad)}` : ''));
kill();
process.exit(r.overflow ? 1 : 0);
