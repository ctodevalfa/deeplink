/**
 * sbpDeepLinks.js + grabDeepLinks.js – consolidated file
 * ---------------------------------------------------------------------------
 *   • sbpDeepLinks.js: generator for Russian SBP/FPS deeplinks (см. предыдущие
 *     ревизии в этом же файле; оставлен без изменений).
 *   • grabDeepLinks.js (Rev 6, 2025‑06‑17): Playwright‑скрейпер для поиска
 *     скрытых deeplink‑ссылок.  Исправлены все падения на старых версиях
 *     Playwright (<1.35), включая «evaluateOnNewDocument is not a function»
 *     и конфликт переопределения window.location.
 * ---------------------------------------------------------------------------
 * USAGE:
 *   node grabDeepLinks.js <URL> [--out=links.json] [--device="Pixel 7"] [--headless=false]
 *
 * NOTE:
 *   • Если Node печатает MODULE_TYPELESS_PACKAGE_JSON, добавьте в корень
 *     проекта файл package.json с содержимым {"type":"module"} или запускайте
 *     скрипт c флагом  --no-warnings.
 *   • Для максимальной совместимости лучше ставить Playwright ≥1.42.
 * ---------------------------------------------------------------------------
 */

/************************ sbpDeepLinks.js (placeholder) ***********************/
// … логика генератора deeplink‑ов остаётся без изменений …

/************************ grabDeepLinks.js ***********************************/
import fs from 'fs/promises';
import path from 'path';
import { chromium, devices } from 'playwright';

/********************  CLI  *****************************/
const argv = process.argv.slice(2);
if (!argv.length) {
  console.error('USAGE: node grabDeepLinks.js <url> [--out=links.json]');
  process.exit(1);
}
const TARGET_URL = argv[0];
const OPTS = Object.fromEntries(
  argv.slice(1).map(a => {
    const [k, v] = a.replace(/^--?/, '').split('=');
    return [k, v ?? true];
  })
);

const DEVICE   = devices[OPTS.device || 'iPhone 13 Pro'] || devices['iPhone 13 Pro'];
const TIMEOUT  = Number(OPTS.timeout || 25000);
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
await fs.mkdir('/tmp/js-sniff', { recursive: true }).catch(() => {});
const browser = await chromium.launch({ headless: HEADLESS });
const ctx     = await browser.newContext({ ...DEVICE, hasTouch: true, locale: 'ru-RU' });
const page    = await ctx.newPage();

/********************  Sniffer JS (string)  *************/
const SNIF_SRC = `(() => {
  const log = url => window.top && window.top.postMessage && window.top.postMessage({ __dl: url }, '*');
  ['pushState','replaceState'].forEach(fn=>{
    const orig = history[fn];
    history[fn] = function(...a){ log(location.href); return orig.apply(this,a); };
  });
  window.addEventListener('beforeunload',()=>log(location.href));
  const _open = window.open;
  window.open = function(u,...r){ log(u); return _open.call(this,u,...r);} ;
  document.addEventListener('click',e=>{const a=e.target.closest('a[href]'); if(a) log(a.href);},true);
})();`;

// add to main context
await page.addInitScript({ content: SNIF_SRC });

// fallback for legacy Playwright: inject into each frame after attach
page.on('frameattached', async f => {
  try {
    if (typeof f.addInitScript === 'function') {
      await f.addInitScript({ content: SNIF_SRC });
    } else if (typeof f.evaluate === 'function') {
      await f.evaluate(SNIF_SRC);
    }
  } catch {}
});

ctx.on('page', p => p.on('pageerror', () => {}));
page.on('pageerror', err => console.error('[PageError]', err.message));

// receive messages from SNIF
page.on('console', msg => {
  try {
    const txt = msg.text();
    if (/^\[DEEPLINK]/.test(txt)) add(txt.slice(10));
  } catch {}
});
page.exposeFunction && await page.exposeFunction('playwrightAddLink', add);
page.on('pageerror', ()=>{});

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
await page.goto(TARGET_URL, { waitUntil: 'networkidle' }).catch(()=>{});
await page.click('text=/pay|оплатить/i').catch(()=>{});
await page.click('text=/sber pay/i').catch(()=>{});
await page.waitForTimeout(TIMEOUT);

await browser.close();
const out = JSON.stringify([...links], null, 2);
if (OUT_FILE) await fs.writeFile(OUT_FILE, out);
console.log(out);
