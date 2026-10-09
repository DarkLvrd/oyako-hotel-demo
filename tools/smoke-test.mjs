#!/usr/bin/env node
/* ============================================================================
 * Smoke test for the Oyako Hotel demo.
 *
 * Launches its own browser - never the one you already have running - loads
 * every deliverable over file:// and over http://, and fails on:
 *   - any console error, uncaught exception, or failed network request
 *   - a missing room card, availability badge, date input or WhatsApp link
 *   - a date change that does not change the availability badges
 *   - horizontal overflow
 *   - a showcase frame that never shows the site (the "Loading the site"
 *     overlay is still visible after the page settles), on BOTH engines,
 *     because the original bug only showed up outside Chrome
 *   - on the deployable site, at phone and tablet widths: horizontal overflow,
 *     a section nav that is cut off or points at a missing section, a tap
 *     target under 44 px, a section that cannot be reached by tapping its nav
 *     link, or a missing card, badge, date field or WhatsApp button
 *
 * Engines:
 *   chrome (default)  Node built-ins only, drives headless Chrome over CDP.
 *   webkit            Optional regression run for Safari's engine. Requires
 *                     Playwright's WebKit, which is not a project dependency:
 *                       npm i playwright && npx playwright install webkit
 *                     then run with --engine webkit. If the module cannot be
 *                     found the run says so instead of silently passing.
 *
 * Usage:
 *   node tools/smoke-test.mjs                    # Chrome, file:// and http://
 *   node tools/smoke-test.mjs --engine both      # Chrome and WebKit
 *   node tools/smoke-test.mjs --engine webkit
 *   node tools/smoke-test.mjs --only dist/       # targets matching a substring
 *   node tools/smoke-test.mjs --scheme file      # only file:// (or http)
 *   node tools/smoke-test.mjs --verbose
 *
 * Env:
 *   PLAYWRIGHT_MODULE   path to the playwright module for --engine webkit
 *                       (default: resolves "playwright")
 *   PLAYWRIGHT_BROWSERS_PATH  where Playwright's browsers live
 * ==========================================================================*/
import { spawn } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');                    // clients/hotel-demo
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf('--' + name);
  if (i === -1) return def;
  const next = argv[i + 1];
  return next === undefined || next.startsWith('--') ? true : next;
}
const ONLY = arg('only', null);
const SCHEME = arg('scheme', 'both');
const ENGINE = arg('engine', 'chrome');
const VERBOSE = argv.includes('--verbose');
const HTTP_PORT = parseInt(arg('port', '8791'), 10);
const SETTLE = parseInt(arg('settle', '2500'), 10);
// how long to give a showcase frame to show the site before calling it stuck;
// the page's own fallback timer is 8 s, so wait a little past that
const SHOWCASE_DEADLINE = parseInt(arg('deadline', '12000'), 10);

// target -> what to assert. `showcase` targets get the iframe checks instead.
// `inlined` says whether the file is expected to carry the site inline.
// `mobile` adds the phone/tablet sweep (run on the deployable site).
const TARGETS = [
  { rel: 'index.html', kind: 'site' },
  { rel: 'showcase.html', kind: 'showcase', inlined: false },
  { rel: 'dist/oyako-hotel.html', kind: 'site' },
  { rel: 'dist/oyako-hotel-showcase.html', kind: 'showcase', inlined: true },
  // deploy/ is the main site only - the presentation showcase is not hosted
  { rel: 'deploy/index.html', kind: 'site', optional: true, mobile: true },
];

// widths a hotel manager's phone or tablet will actually open the link at
const MOBILE_SIZES = [
  { label: '360x740 phone', w: 360, h: 740 },
  { label: '390x844 phone', w: 390, h: 844 },
  { label: '430x932 phone', w: 430, h: 932 },
  { label: '768x1024 tablet', w: 768, h: 1024 },
  { label: '844x390 phone landscape', w: 844, h: 390 },
];

/* --------------------------------------------------------------- assertions */
// Runs inside the page. Collects everything the test cares about.
const SITE_PROBE = `(async () => {
  const out = {};
  const cards = [...document.querySelectorAll('#room-grid .card')];
  out.cards = cards.length;
  out.badges = document.querySelectorAll('#room-grid .badge').length;
  out.badgeText = [...document.querySelectorAll('#room-grid .badge')].map(b => b.textContent.trim());
  out.ready = document.documentElement.classList.contains('ready');
  out.checkin = !!document.getElementById('checkin');
  out.checkout = !!document.getElementById('checkout');
  out.guests = !!document.getElementById('guests');
  const wa = document.querySelector('.wa-link');
  out.wa = wa ? wa.getAttribute('href') : null;
  const book = document.querySelector('#room-grid .btn.primary');
  out.bookHref = book ? book.getAttribute('href') : null;
  out.title = document.title;
  out.h1 = document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : null;

  // the picker has to actually drive the availability
  if (out.checkin && out.checkout) {
    document.getElementById('checkin').value = '2026-12-24';
    document.getElementById('checkout').value = '2026-12-27';
    document.getElementById('guests').value = '4';
    document.getElementById('bookform')
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await new Promise(r => setTimeout(r, 350));
    out.badgeTextAfter = [...document.querySelectorAll('#room-grid .badge')].map(b => b.textContent.trim());
    out.stayLine = (document.getElementById('stay-line') || {}).textContent || '';
  }

  // scroll slowly enough that lazy images below the fold start loading
  const step = Math.max(300, Math.round(window.innerHeight * 0.6));
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 140));
  }
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 900));
  out.images = document.images.length;
  out.imagesPending = [...document.images].filter(i => !i.complete).length;
  // an image only counts as broken if the browser TRIED and failed. A lazy
  // image that never entered the viewport is complete === false, not broken.
  out.imagesBroken = [...document.images]
    .filter(i => i.complete && i.naturalWidth === 0 && !!i.getAttribute('src')).length;
  out.overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return out;
})()`;

// Showcase. Cross-origin frame introspection is only attempted over http://
// (same origin); on file:// each frame has an opaque origin and touching
// contentDocument is a security error that WebKit reports as a page error even
// when caught. The framed site instead proves it booted by posting a message,
// which showcase.html records as data-ready="1" on the frame's screen.
const SHOWCASE_PROBE = `(async () => {
  const out = {};
  out.modes = [...document.querySelectorAll('.switch button')].map(b => b.dataset.mode);
  out.mode = document.body.dataset.mode;
  out.frames = {
    desktop: !!document.querySelector('[data-frame="desktop"]'),
    mobile: !!document.querySelector('[data-frame="mobile"]'),
  };
  out.inlined = Object.prototype.hasOwnProperty.call(window, 'OYAKO_SITE_HTML');
  out.inlineLen = out.inlined ? (window.OYAKO_SITE_HTML || '').length : 0;
  out.brand = (document.getElementById('brand-name') || {}).textContent || '';
  out.sameOrigin = location.protocol === 'http:' || location.protocol === 'https:';

  const screenOf = k => document.querySelector('[data-slot="' + k + '"] .screen');
  const state = k => {
    const s = screenOf(k);
    if (!s) return null;
    const ph = s.querySelector('.ph');
    return {
      loaded: s.dataset.loaded === '1',
      ready: s.dataset.ready === '1',
      overlayVisible: !!(ph && getComputedStyle(ph).display !== 'none'),
    };
  };

  // wait up to the deadline for every VISIBLE frame to show the site
  const t0 = Date.now();
  for (;;) {
    const visible = ['desktop', 'mobile'].filter(k => {
      const slot = document.querySelector('[data-slot="' + k + '"]');
      return slot && !slot.hidden;
    });
    const st = visible.map(k => state(k));
    if (st.length && st.every(s => s && s.loaded && !s.overlayVisible)) break;
    if (Date.now() - t0 > ${SHOWCASE_DEADLINE}) break;
    await new Promise(r => setTimeout(r, 250));
  }
  out.waitMs = Date.now() - t0;
  out.stateDesktop = state('desktop');
  out.stateMobile = state('mobile');
  out.stuck = ['desktop', 'mobile'].filter(k => {
    const slot = document.querySelector('[data-slot="' + k + '"]');
    if (!slot || slot.hidden) return false;
    const s = state(k);
    return !s || !s.loaded || s.overlayVisible;
  });

  // the switch has to work
  const btn = document.querySelector('.switch button[data-mode="mobile"]');
  if (btn) {
    btn.click();
    await new Promise(r => setTimeout(r, 400));
    out.modeAfterClick = document.body.dataset.mode;
    out.desktopHidden = document.querySelector('[data-slot="desktop"]').hidden;
    const s = state('mobile');
    out.mobileAfterClick = s;
  }

  // same-origin only: look inside the phone frame
  if (out.sameOrigin) {
    try {
      const f = document.querySelector('[data-frame="mobile"]');
      const doc = f && f.contentDocument;
      if (doc && doc.querySelectorAll('#room-grid .card').length) {
        out.innerCards = doc.querySelectorAll('#room-grid .card').length;
        out.innerBadges = doc.querySelectorAll('#room-grid .badge').length;
        out.innerCheckin = !!doc.getElementById('checkin');
        out.innerWa = !!doc.querySelector('.wa-link');
      }
    } catch (e) { out.innerError = String(e).slice(0, 90); }
  }

  out.overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return out;
})()`;

function checkSite(o) {
  const bad = [];
  if (!o.ready) bad.push('page never finished booting (html.ready missing)');
  if (o.cards !== 5) bad.push(`expected 5 room cards, got ${o.cards}`);
  if (o.badges !== 5) bad.push(`expected 5 availability badges, got ${o.badges}`);
  if (!o.checkin || !o.checkout || !o.guests) bad.push('booking date picker or guest select missing');
  if (!o.wa || !/^https:\/\/wa\.me\/\d+\?text=/.test(o.wa)) bad.push('WhatsApp link missing or malformed: ' + o.wa);
  if (o.bookHref && !/^https:\/\/wa\.me\//.test(o.bookHref)) bad.push('room Book link is not a wa.me link');
  if (o.badgeText && o.badgeTextAfter && o.badgeText.join('|') === o.badgeTextAfter.join('|')) {
    bad.push('changing the dates did not change any availability badge');
  }
  if (o.overflowX > 1) bad.push(`horizontal overflow of ${o.overflowX}px`);
  // only images the browser tried and failed on count; pending lazy images do not
  if (o.imagesBroken > 0) bad.push(`${o.imagesBroken} of ${o.images} images failed to load`);
  return bad;
}

function checkShowcase(o, t) {
  const bad = [];
  if (!o.modes || o.modes.length !== 3) bad.push('expected 3 mode buttons, got ' + (o.modes || []).length);
  if (!o.frames.desktop || !o.frames.mobile) bad.push('a desktop or mobile frame is missing');
  // only the single-file showcase carries the whole site inline
  if (t.inlined && o.inlineLen === 0) bad.push('no embedded site (window.OYAKO_SITE_HTML missing)');
  if (o.stuck && o.stuck.length) {
    const d = o.stateDesktop, m = o.stateMobile;
    bad.push(`the ${o.stuck.join(' + ')} frame never showed the site ` +
      `(after ${o.waitMs} ms; desktop=${JSON.stringify(d)} mobile=${JSON.stringify(m)})`);
  }
  if (o.modeAfterClick !== 'mobile') bad.push('mode switch did not take effect (got ' + o.modeAfterClick + ')');
  if (o.desktopHidden !== true) bad.push('desktop frame was not hidden in mobile mode');
  if (o.mobileAfterClick && (o.mobileAfterClick.overlayVisible || !o.mobileAfterClick.loaded)) {
    bad.push('the mobile frame lost the site when switched to mobile-only mode');
  }
  if (o.innerCards !== undefined && o.innerCards !== 5) {
    bad.push(`the framed site rendered ${o.innerCards} room cards, expected 5`);
  }
  if (o.innerBadges !== undefined && o.innerBadges !== 5) {
    bad.push(`the framed site rendered ${o.innerBadges} badges, expected 5`);
  }
  if (o.innerCheckin === false) bad.push('the framed site has no date picker');
  if (o.innerWa === false) bad.push('the framed site has no WhatsApp link');
  if (o.overflowX > 1) bad.push(`horizontal overflow of ${o.overflowX}px`);
  return bad;
}

/* ------------------------------------------------- mobile / tablet checks */
// Runs inside the page at one phone or tablet size. Reflow only - the runner
// changes the viewport and re-runs this, so no reload is needed.
const MOBILE_PROBE = `(async () => {
  const out = {};
  const R = e => e.getBoundingClientRect();
  out.overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  out.cards = document.querySelectorAll('#room-grid .card').length;
  out.badges = document.querySelectorAll('#room-grid .badge').length;
  out.checkin = !!document.getElementById('checkin');
  out.checkout = !!document.getElementById('checkout');
  out.guests = !!document.getElementById('guests');
  out.wa = !!document.querySelector('.wa-link');

  const nav = document.getElementById('nav');
  const links = nav ? [...nav.querySelectorAll('a')] : [];
  out.navLinks = links.length;
  out.navScrollable = nav ? nav.scrollWidth > nav.clientWidth + 1 : null;
  out.navLinksInView = links.every(a => { const b = R(a); return b.left >= -1 && b.right <= innerWidth + 1; });
  out.navTargetsExist = links.every(a => !!document.querySelector(a.getAttribute('href')));
  out.headerH = Math.round(document.querySelector('.site-header').getBoundingClientRect().height);

  // every interactive element has to be big enough for a thumb
  const small = [];
  document.querySelectorAll('a, button, input, select, textarea').forEach(e => {
    const s = getComputedStyle(e);
    const b = R(e);
    if (s.display === 'none' || s.visibility === 'hidden' || s.pointerEvents === 'none') return;
    if (b.width === 0 || b.height === 0) return;
    if (b.width < 44 || b.height < 44) {
      small.push({ tag: e.tagName.toLowerCase(), text: (e.textContent || e.value || '').trim().slice(0, 18), w: Math.round(b.width), h: Math.round(b.height) });
    }
  });
  out.smallTargets = small.length;
  out.smallList = small.slice(0, 8);

  // can a thumb reach every section? tap each nav link and see where the
  // section lands relative to the sticky header. Poll because the scroll can
  // land a beat late while the page is still busy decoding images.
  out.reach = [];
  if (links.length) {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    for (const a of links) {
      const id = (a.getAttribute('href') || '').slice(1);
      const sec = document.getElementById(id);
      if (!sec) { out.reach.push({ id, ok: false, why: 'missing section' }); continue; }
      scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 60));
      a.click();
      let top = Math.round(R(sec).top);
      let ok = false;
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 100));
        top = Math.round(R(sec).top);
        if (top >= out.headerH - 10 && top <= out.headerH + 140) { ok = true; break; }
      }
      out.reach.push({ id, top, ok });
    }
    document.documentElement.style.scrollBehavior = prev;
    scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 60));
  }
  return out;
})()`;

function checkMobile(o, size) {
  const bad = [];
  if (o.overflowX > 1) bad.push(`horizontal overflow of ${o.overflowX}px at ${size}`);
  if (o.cards !== 5) bad.push(`expected 5 room cards at ${size}, got ${o.cards}`);
  if (o.badges !== 5) bad.push(`expected 5 availability badges at ${size}, got ${o.badges}`);
  if (!o.checkin || !o.checkout || !o.guests) bad.push(`booking controls missing at ${size}`);
  if (!o.wa) bad.push(`WhatsApp button missing at ${size}`);
  if (o.navLinks < 6) bad.push(`expected 6 section links at ${size}, got ${o.navLinks}`);
  if (o.navScrollable) bad.push(`the section nav is cut off at ${size} (needs sideways scrolling)`);
  if (!o.navLinksInView) bad.push(`not every section link is on screen at ${size}`);
  if (!o.navTargetsExist) bad.push(`a section link points at a missing section at ${size}`);
  if (o.smallTargets) {
    bad.push(`${o.smallTargets} tap target(s) under 44px at ${size}: ` + JSON.stringify(o.smallList));
  }
  const unreachable = (o.reach || []).filter(r => !r.ok);
  if (unreachable.length) bad.push(`section(s) not reachable at ${size}: ` + JSON.stringify(unreachable));
  return bad;
}

/* ================================ chrome ================================= */
async function startChrome(port) {
  const profile = join(tmpdir(), `fm-smoke-${port}-${Date.now()}`);
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-sync', '--mute-audio',
    '--window-size=1440,900', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d.toString(); });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let version = null;
  for (let i = 0; i < 120; i++) {
    if (proc.exitCode !== null) throw new Error('chrome exited early:\n' + stderr.slice(0, 400));
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; }
    catch { await sleep(150); }
  }
  if (!version) throw new Error('chrome never came up');
  return {
    name: 'chrome',
    version,
    async close() {
      try { proc.kill('SIGKILL'); } catch {}
      try { rmSync(profile, { recursive: true, force: true }); } catch {}
    },
  };
}

function makeClient(ws) {
  let seq = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
      return;
    }
    for (const fn of listeners.get(m.method) || []) fn(m.params);
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); } }, 180000);
  });
  const on = (method, fn) => listeners.set(method, [...(listeners.get(method) || []), fn]);
  const once = (method) => new Promise((res) => {
    const fn = (p) => {
      listeners.set(method, (listeners.get(method) || []).filter((f) => f !== fn));
      res(p);
    };
    listeners.set(method, [...(listeners.get(method) || []), fn]);
  });
  return { send, on, once };
}

async function chromeRunTarget(client, url, kind, job) {
  const notes = [];
  const { send, on, once } = client;
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, S);
  await send('Runtime.enable', {}, S);
  await send('Network.enable', {}, S);
  await send('Log.enable', {}, S);

  on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'warning' || VERBOSE) {
      const text = (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ');
      notes.push({ level: p.type === 'error' ? 'error' : 'info', text: 'console.' + p.type + ': ' + text });
    }
  });
  on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails || {};
    const msg = (d.exception && (d.exception.description || d.exception.value)) || d.text || 'exception';
    notes.push({ level: 'error', text: 'uncaught: ' + String(msg).split('\n')[0] });
  });
  on('Log.entryAdded', (p) => {
    const e = p.entry || {};
    if (e.level === 'error' || VERBOSE) {
      notes.push({ level: e.level === 'error' ? 'error' : 'info', text: `${e.source}: ${e.text}${e.url ? ' <' + e.url.slice(-60) + '>' : ''}` });
    }
  });
  on('Network.loadingFailed', (p) => {
    if (p.canceled) return;                        // lazy images cancelled on scroll
    if (p.errorText === 'net::ERR_ABORTED') return;
    notes.push({ level: 'error', text: `request failed: ${p.errorText} (${p.type})` });
  });
  on('Network.responseReceived', (p) => {
    const r = p.response || {};
    if (r.status >= 400) notes.push({ level: 'error', text: `HTTP ${r.status} for ${String(r.url).slice(-70)}` });
  });

  const t0 = Date.now();
  await send('Page.navigate', { url }, S);
  await Promise.race([once('Page.loadEventFired'), new Promise((r) => setTimeout(r, 60000))]);
  await new Promise((r) => setTimeout(r, SETTLE));

  const probe = kind === 'site' ? SITE_PROBE : SHOWCASE_PROBE;
  let result = null, evalError = null;
  try {
    const r = await send('Runtime.evaluate', { expression: probe, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) {
      evalError = (r.exceptionDetails.exception && r.exceptionDetails.exception.description) ||
        r.exceptionDetails.text;
    } else {
      result = r.result.value;
    }
  } catch (e) { evalError = e.message; }

  // phone / tablet sweep on the same page, no reload
  const mobile = [];
  if (job && job.mobile && !evalError) {
    for (const size of MOBILE_SIZES) {
      await send('Emulation.setDeviceMetricsOverride',
        { width: size.w, height: size.h, deviceScaleFactor: 2, mobile: true }, S);
      await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' }, S).catch(() => {});
      await new Promise((r) => setTimeout(r, 350));
      const r = await send('Runtime.evaluate',
        { expression: MOBILE_PROBE, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) {
        mobile.push({ size: size.label, problems: ['probe threw: ' + String(r.exceptionDetails.text).slice(0, 120)] });
      } else {
        mobile.push({ size: size.label, problems: checkMobile(r.result.value, size.label), info: r.result.value });
      }
    }
    await send('Emulation.clearDeviceMetricsOverride', {}, S).catch(() => {});
  }

  await send('Target.closeTarget', { targetId }).catch(() => {});
  return { loadMs: Date.now() - t0, notes, result, evalError, mobile };
}

/* ================================ webkit ================================= */
async function loadPlaywright() {
  const spec = process.env.PLAYWRIGHT_MODULE || 'playwright';
  const target = spec.startsWith('/') || spec.startsWith('file:') ? pathToFileURL(spec).href : spec;
  return import(target);
}

async function startWebKit() {
  let mod;
  try { mod = await loadPlaywright(); }
  catch (e) {
    throw new Error('playwright is not installed (set PLAYWRIGHT_MODULE to its path, ' +
      'or run: npm i playwright && npx playwright install webkit). ' + String(e.message).split('\n')[0]);
  }
  const browser = await mod.webkit.launch();
  return { name: 'webkit', browser, async close() { await browser.close(); } };
}

async function webkitRunTarget(browser, url, kind, job) {
  const notes = [];
  const mobileSweep = !!(job && job.mobile);
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    // a phone profile: touch input and a mobile viewport, like an iPhone
    ...(mobileSweep ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || VERBOSE) {
      notes.push({ level: m.type() === 'error' ? 'error' : 'info', text: 'console.error: ' + m.text().slice(0, 160) });
    }
  });
  page.on('pageerror', (e) => notes.push({ level: 'error', text: 'uncaught: ' + String(e).split('\n')[0].slice(0, 160) }));
  page.on('requestfailed', (r) => {
    const t = (r.failure() && r.failure().errorText) || '';
    if (/abort/i.test(t)) return;
    notes.push({ level: 'error', text: 'request failed: ' + t + ' ' + r.url().slice(-60) });
  });
  page.on('response', (r) => {
    if (r.status() >= 400) notes.push({ level: 'error', text: `HTTP ${r.status()} for ${r.url().slice(-60)}` });
  });

  const t0 = Date.now();
  let result = null, evalError = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(SETTLE);
    result = await page.evaluate(kind === 'site' ? SITE_PROBE : SHOWCASE_PROBE);
  } catch (e) {
    evalError = String(e).split('\n')[0];
  }

  const mobile = [];
  if (mobileSweep && !evalError) {
    for (const size of MOBILE_SIZES) {
      try {
        await page.setViewportSize({ width: size.w, height: size.h });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(350);
        const info = await page.evaluate(MOBILE_PROBE);
        mobile.push({ size: size.label, problems: checkMobile(info, size.label), info });
      } catch (e) {
        mobile.push({ size: size.label, problems: ['probe threw: ' + String(e).split('\n')[0].slice(0, 120)] });
      }
    }
  }

  await ctx.close();
  return { loadMs: Date.now() - t0, notes, result, evalError, mobile };
}

/* --------------------------------------------------------------------- main */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const engines = ENGINE === 'both' ? ['chrome', 'webkit']
  : ENGINE === 'webkit' ? ['webkit']
  : ['chrome'];

let chrome = null, webkit = null, httpServer = null;
try {
  if (engines.includes('chrome')) {
    if (!existsSync(CHROME)) throw new Error('Chrome not found at ' + CHROME);
    chrome = await startChrome(9400 + Math.floor(Math.random() * 400));
  }
  if (engines.includes('webkit')) webkit = await startWebKit();

  const schemes = [];
  if (SCHEME === 'both' || SCHEME === 'file') schemes.push('file');
  if (SCHEME === 'both' || SCHEME === 'http') schemes.push('http');

  let repoRoot = null;
  if (schemes.includes('http')) {
    // Served from the repository root so that dist/… and deploy/… are reachable.
    // A threading server, not plain `http.server`: the single-threaded one drops
    // parallel image requests and the smoke test would fail on connection
    // resets that have nothing to do with the site.
    repoRoot = join(ROOT, '..', '..');
    const server = [
      'import functools, sys',
      'from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler',
      "handler = functools.partial(SimpleHTTPRequestHandler, directory=sys.argv[1])",
      "ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), handler).serve_forever()",
    ].join('\n');
    const proc = spawn('python3', ['-c', server, repoRoot, String(HTTP_PORT)],
      { stdio: ['ignore', 'ignore', 'ignore'] });
    httpServer = { kill() { try { proc.kill('SIGKILL'); } catch {} } };
    await sleep(800);
  }

  const jobs = [];
  for (const t of TARGETS) {
    if (t.optional && !existsSync(join(ROOT, t.rel))) continue;
    if (ONLY && !t.rel.includes(ONLY)) continue;
    if (schemes.includes('file')) {
      jobs.push({ ...t, label: 'file://' + t.rel, url: 'file://' + join(ROOT, t.rel) });
    }
    if (schemes.includes('http')) {
      jobs.push({ ...t, label: 'http://' + t.rel,
        url: `http://127.0.0.1:${HTTP_PORT}/clients/hotel-demo/${t.rel}` });
    }
  }

  if (!jobs.length) {
    console.error('no targets matched');
    process.exit(2);
  }

  let chromeClient = null;
  if (chrome) {
    const ws = new WebSocket(chrome.version.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    chromeClient = makeClient(ws);
  }

  let failed = 0;
  for (const engineName of engines) {
    console.log(`smoke test [${engineName}] — ${jobs.length} target(s)\n`);
    for (const job of jobs) {
      process.stdout.write(`  ${job.label.padEnd(58)} `);
      let r;
      try {
        r = engineName === 'chrome'
          ? await chromeRunTarget(chromeClient, job.url, job.kind, job)
          : await webkitRunTarget(webkit.browser, job.url, job.kind, job);
      } catch (e) {
        console.log('FAIL (harness)');
        console.log('      ' + e.message);
        failed++;
        continue;
      }
      const problems = [];
      if (r.evalError) problems.push('probe threw: ' + String(r.evalError).split('\n')[0]);
      else if (r.result) {
        problems.push(...(job.kind === 'site' ? checkSite(r.result) : checkShowcase(r.result, job)));
      } else {
        problems.push('probe returned nothing');
      }
      for (const n of r.notes) if (n.level === 'error') problems.push(n.text);

      // phone / tablet sweep results
      for (const m of (r.mobile || [])) problems.push(...m.problems);

      if (VERBOSE) for (const n of r.notes) console.log('      · ' + n.text);
      if (VERBOSE) for (const m of (r.mobile || [])) {
        const i = m.info || {};
        console.log(`      · ${m.size}: overflow=${i.overflowX} navScroll=${i.navScrollable} ` +
          `linksInView=${i.navLinksInView} small=${i.smallTargets} reach=${(i.reach || []).filter(x => x.ok).length}/${(i.reach || []).length}`);
      }
      if (problems.length) {
        failed++;
        console.log(`FAIL  (${r.loadMs} ms)`);
        for (const p of problems.slice(0, 12)) console.log('      ✗ ' + p);
      } else {
        const bits = [];
        if (job.kind === 'site') {
          bits.push(`${r.result.cards} cards`, `${r.result.badges} badges`,
            `${r.result.images - r.result.imagesBroken}/${r.result.images} images`);
          if (r.mobile && r.mobile.length) {
            bits.push(`${r.mobile.length} phone/tablet sizes ok`);
          }
        } else {
          const st = [r.result.stateDesktop, r.result.stateMobile].filter(Boolean);
          bits.push(`mode=${r.result.modeAfterClick || r.result.mode}`,
            st.map((s) => `${s.loaded ? 'loaded' : 'stuck'}${s.ready ? '+msg' : ''}`).join('/'));
          if (r.result.innerCards !== undefined) bits.push(`${r.result.innerCards} cards in frame`);
        }
        console.log(`ok    (${r.loadMs} ms)  ${bits.join(', ')}`);
      }
    }
    console.log('');
  }

  console.log(failed ? `${failed} target(s) FAILED` : 'all targets passed');
  if (chrome) await chrome.close();
  if (webkit) await webkit.close();
  if (httpServer) httpServer.kill();
  process.exit(failed ? 1 : 0);
} catch (err) {
  console.error('smoke test could not run: ' + err.message);
  if (chrome) await chrome.close().catch(() => {});
  if (webkit) await webkit.close().catch(() => {});
  if (httpServer) httpServer.kill();
  process.exit(2);
}
