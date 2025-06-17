/**
 * sbpDeepLinks.js + grabDeepLinks.js – consolidated file
 * ---------------------------------------------------------------------------
 *   • sbpDeepLinks.js: generator for Russian SBP/FPS deeplinks (see earlier).
 *   • grabDeepLinks.js (Rev 5, 2025‑06‑17): Playwright scraper that discovers
 *     hidden deeplinks automatically – patched for legacy Playwright (<1.40)
 *     and Node ESM warnings.
 * ---------------------------------------------------------------------------
 * USAGE:
 *   node grabDeepLinks.js <URL> [--out=links.json] [--device="Pixel 7"] [--headless=false]
 *
 * NOTE:
 *   If Node prints MODULE_TYPELESS_PACKAGE_JSON, just add {"type":"module"}
 *   to package.json or run with `node --no-warnings grabDeepLinks.js …`.
 * ---------------------------------------------------------------------------
 */

/************************ sbpDeepLinks.js (placeholder) ***********************/
// … (оставляем неизменным; см. предыдущие ревизии)

/************************ grabDeepLinks.js ***********************************/
import fs from 'fs/promises';
import path from 'path';
import { chromium, devices } from 'playwright';

/********************  CLI  *****************************/
const argv = process.argv.slice(2);
if (!argv.length) {
  console.error('USAGE: node grabDeepLinks.js <url> [--device="Pixel 7"] [--timeout=20000]');
  process.exit(1);
}
const TARGET_URL = argv[0];
const OPTS = Object.fromEntries(argv.slice(1).map(a => {
  const [k, v] = a.replace(/^--?/, '').split('=');
  return [k, v ?? true];
}));

const DEVICE   = devices[OPTS.device || 'iPhone 13 Pro'] || devices['iPhone 13 Pro'];
const TIMEOUT  = Number(OPTS.timeout || 20000);
const HEADLESS = String(OPTS.headless || 'true') !== 'false';
const OUT_FILE = OPTS.out || null;

/********************  Collectors  *********************/
const links = new Set();
const add = u => {
  if (!u) return;
  if (/^(https?|wss?|file):\/\//i.test(u)) return;
  if (/^data:image\//i.test(u)) return;
  links.add(u);
};

/********************  Browser  *************************/
await fs.mkdir('/tmp/js-sniff', { recursive: true }).catch(()=>{});
const browser = await chromium.launch({ headless: HEADLESS });
const ctx     = await browser.newContext({ ...DEVICE, hasTouch: true, locale: 'ru-RU' });
const page    = await ctx.newPage();

/********************  Sniffer code  *******************/
const SNIF = () => {
  const log = url => window.top.postMessage({ __dl: url }, '*');

  /* history API */
  ['pushState', 'replaceState'].forEach(fn => {
    const orig = history[fn];
    history[fn] = function (...args) {
      log(location.href);
      return orig.apply(this, args);
    };
  });

  window.addEventListener('beforeunload', () => log(location.href));

  /* window.open */
  const op = window.open;
  window.open = function (u, ...rest) { log(u); return op.call(this, u, ...rest); };

  /* clicks */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (a) log(a.href);
  }, true);
};

await page.addInitScript(SNIF);

// —— robust frame injection, compatible with old Playwright builds —— //
page.on('frameattached', f => {
  try {
    if (typeof f.addInitScript === 'function') {
      f.addInitScript(SNIF);
    } else if (typeof f.evaluateOnNewDocument === 'function') {
      f.evaluateOnNewDocument(SNIF);
    } else {
      f.evaluate(SNIF);
    }
  } catch {}
});

ctx.on('page', p => p.on('pageerror', () => {}));
page.on('pageerror', err => console.error('[PageError]', err.message));

/********************  Network hooks  ******************/
page.on('request', r => {
  const u = r.url();
  const m = /\/deep\.html\?([a-z0-9_\-]+)/i.exec(u);
  if (m) add(`${m[1]}://`);
});
page.on('response', async resp => {
  try {
    const url = resp.url();
    const ct  = resp.headers()['content-type'] || '';
    if (ct.includes('javascript') || url.endsWith('.js')) {
      const body = await resp.text();
      await fs.writeFile('/tmp/js-sniff/' + path.basename(url.split('?')[0]), body).catch(()=>{});
      (body.match(/([\w.+-]+:\/\/[\w@%./#?=&~;-]{6,})/g) || []).forEach(add);
    }
  } catch {}
});

/********************  Main flow  **********************/
await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
await page.click('text=/pay|оплатить/i').catch(()=>{});
await page.click('text=/sber pay/i').catch(()=>{});
await page.waitForTimeout(TIMEOUT);

await browser.close();
const out = JSON.stringify([...links], null, 2);
if (OUT_FILE) await fs.writeFile(OUT_FILE, out);
console.log(out);
