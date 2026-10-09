#!/usr/bin/env node
// Dependency-free full-page screenshotter: drives our own headless Google Chrome
// over the DevTools protocol using Node built-ins only (global fetch + WebSocket).
//
// usage:
//   node shot.mjs --url <url> --out <file.png> [--w 1440] [--h 900] [--full]
//                 [--mobile] [--wait 5000] [--max-h 12000] [--hide-overlays] [--dpr 1]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
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
const out = arg('out');
const W = parseInt(arg('w', '1440'), 10);
const H = parseInt(arg('h', '900'), 10);
const FULL = flag('full');
const MOBILE = flag('mobile');
const WAIT = parseInt(arg('wait', '6000'), 10);
const MAXH = parseInt(arg('max-h', '12000'), 10);
const HIDE = flag('hide-overlays');
const DPR = parseFloat(arg('dpr', MOBILE ? '2' : '1'));
const SCROLL = !flag('no-scroll');

if (!url || !out) {
  console.error('need --url and --out');
  process.exit(2);
}
mkdirSync(dirname(out), { recursive: true });

const PORT = 9500 + Math.floor(Math.random() * 400);
const profile = `${tmpdir()}/fm-shot-${PORT}-${Date.now()}`;

const desktopUA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';
const mobileUA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1';

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-features=Translate,OptimizationHints,MediaRouter',
    '--disable-blink-features=AutomationControlled',
    '--hide-scrollbars',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    '--force-device-scale-factor=' + DPR,
    `--window-size=${W},${H}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] }
);
let chromeErr = '';
chrome.stderr.on('data', (d) => (chromeErr += d.toString()));

function kill() {
  try { chrome.kill('SIGKILL'); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
process.on('exit', kill);

let version = null;
for (let i = 0; i < 100; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    version = await r.json();
    break;
  } catch {
    await sleep(150);
  }
}
if (!version) {
  console.error('chrome never came up\n' + chromeErr);
  process.exit(3);
}

const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = (e) => rej(new Error('ws error ' + (e?.message || '')));
});

let seq = 0;
const pending = new Map();
const listeners = new Map();
ws.onmessage = (ev) => {
  let msg;
  try { msg = JSON.parse(ev.data); } catch { return; }
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    return;
  }
  if (msg.method) {
    for (const fn of listeners.get(msg.method) || []) fn(msg.params);
  }
};
function send(method, params = {}, sessionId) {
  const id = ++seq;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); }
    }, 60000);
  });
}
function once(method, sessionId) {
  return new Promise((res) => {
    const arr = listeners.get(method) || [];
    const fn = (p) => {
      listeners.set(method, (listeners.get(method) || []).filter((f) => f !== fn));
      res(p);
    };
    arr.push(fn);
    listeners.set(method, arr);
  });
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = sessionId;

await send('Page.enable', {}, S);
await send('Runtime.enable', {}, S);
await send('Network.enable', {}, S);
await send('Emulation.setDeviceMetricsOverride', {
  width: W, height: H, deviceScaleFactor: DPR, mobile: MOBILE,
  screenWidth: W, screenHeight: H,
}, S);
await send('Emulation.setUserAgentOverride', {
  userAgent: MOBILE ? mobileUA : desktopUA,
  acceptLanguage: 'en-US,en;q=0.9',
  platform: MOBILE ? 'iPhone' : 'MacIntel',
}, S);
if (MOBILE) {
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, S);
}

let loadErr = null;
try {
  await send('Page.navigate', { url }, S);
  await Promise.race([once('Page.loadEventFired', S), sleep(30000)]);
} catch (e) { loadErr = e.message; }

await sleep(Math.min(WAIT, 4000));

if (HIDE) {
  const css = `
    #onetrust-consent-sdk,#onetrust-banner-sdk,#CybotCookiebotDialog,#didomi-host,
    .cc-window,.ot-sdk-container,#cookiescript_injected,#axeptio_overlay,
    [id*="cookie" i][class*="banner" i],[class*="cookie" i][class*="banner" i],
    [id*="consent" i][role="dialog"],[class*="consent" i][class*="banner" i],
    #usercentrics-root,[id*="gdpr" i][role="dialog"]{display:none!important;visibility:hidden!important}
    html,body{overflow-x:hidden!important}
  `;
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(function(){const s=document.createElement('style');s.textContent=${JSON.stringify(css)};(document.head||document.documentElement).appendChild(s);})()`,
  }, S).catch(() => {});
  await send('Runtime.evaluate', {
    expression: `(function(){const s=document.createElement('style');s.textContent=${JSON.stringify(css)};(document.head||document.documentElement).appendChild(s);return 1})()`,
  }, S).catch(() => {});
}

// Give lazy content a chance: walk the page, then return to the top.
if (SCROLL) {
  await send('Runtime.evaluate', {
    expression: `(async()=>{const step=Math.round(window.innerHeight*0.8)||600;
      for(let y=0;y<document.body.scrollHeight+step;y+=step){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,180));}
      window.scrollTo(0,0);await new Promise(r=>setTimeout(r,700));return document.body.scrollHeight;})()`,
    awaitPromise: true, timeout: 60000,
  }, S).catch(() => {});
}

// Hero films are common on five-star sites; nudge them into frame 1.
await send('Runtime.evaluate', {
  expression: `(async()=>{const vs=Array.from(document.querySelectorAll('video'));
    for(const v of vs){try{v.muted=true;v.setAttribute('playsinline','');v.currentTime=1.2;await v.play();}catch{}}
    await new Promise(r=>setTimeout(r,1500));return vs.length})()`,
  awaitPromise: true, timeout: 15000,
}, S).catch(() => {});

// Wait for images that are already in the DOM.
await send('Runtime.evaluate', {
  expression: `Promise.all(Array.from(document.images).filter(i=>!i.complete).map(i=>new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,4000)}))).then(()=>1)`,
  awaitPromise: true, timeout: 30000,
}, S).catch(() => {});

await sleep(600);

const overflow = await send('Runtime.evaluate', {
  expression: `JSON.stringify({vw:document.documentElement.clientWidth,docW:document.documentElement.scrollWidth})`,
  returnByValue: true,
}, S).then((r) => JSON.parse(r.result.value)).catch(() => null);
if (overflow && overflow.docW > overflow.vw) {
  console.error(`!! HORIZONTAL OVERFLOW at ${overflow.vw}px: document is ${overflow.docW}px wide`);
}

const metrics = await send('Page.getLayoutMetrics', {}, S).catch(() => null);
const content = metrics?.cssContentSize || metrics?.contentSize;
let capW = W, capH = H;
if (FULL && content) {
  const cw = Math.ceil(content.width) || W;
  const ch = Math.ceil(content.height) || H;
  const scale = cw > W ? W / cw : 1;              // never wider than requested viewport
  capW = Math.round(cw * scale);
  capH = Math.min(Math.round(ch * scale), MAXH);
}

let shot;
try {
  shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: FULL,
    ...(FULL ? { clip: { x: 0, y: 0, width: capW, height: capH, scale: 1 } } : {}),
    optimizeForSpeed: false,
  }, S);
} catch (e) {
  console.error('capture failed: ' + e.message);
  process.exit(4);
}
writeFileSync(out, Buffer.from(shot.data, 'base64'));
const title = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true }, S)
  .then((r) => r.result?.value).catch(() => '');
console.log(JSON.stringify({ ok: true, out, url, w: capW, h: capH, title, loadErr, overflow: overflow ? overflow.docW > overflow.vw : null }));
kill();
process.exit(0);
