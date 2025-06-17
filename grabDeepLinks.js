/* ===========================================================================
   grabDeepLinks.js   –   вытягивает deep-link URL-ы (intent://, sberbankonline:// …)
   из одностраничных платёжных сайтов.
   Автор: 17 июня 2025 • Rev 9c
============================================================================ */

import fs from 'node:fs';
import { chromium, devices } from 'playwright';

/* ---------- ПАРАМЕТРЫ CLI ------------------------------------------------- */
const [,, URL] = process.argv;
if (!URL) {
  console.error('Usage: node grabDeepLinks.js <url> [--out=file] [--headless=false] [--device="Pixel 7"] [--timeout=30000]');
  process.exit(1);
}

const OUT      = arg('--out')      ?? null;      // файл-вывода JSON
const HEADLESS = arg('--headless') === 'false' ? false : true;
const DEVICE   = arg('--device')   ?? 'iPhone 13 Pro';
const TIMEOUT  = Number(arg('--timeout') ?? 20000);

/* ---------- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ CLI-ФЛАГОВ ----------------------- */
function arg(name) {
  const a = process.argv.find(x => x.startsWith(name + '='));
  return a ? a.split('=').slice(1).join('=') : null;
}

/* ---------- СНИФФЕР (вставляется в каждый фрейм) ------------------------- */
const SNIF_SRC = String(() => {
  const _seen = new Set();
  const log   = u => {
    if (!_seen.has(u)) {
      _seen.add(u);
      console.log('[DL]', u);
    }
  };

  /* Location.href / assign / replace */
  ['assign', 'replace'].forEach(m => {
    const orig = Location.prototype[m];
    Location.prototype[m] = function (url) { log(url); return orig.call(this, url); };
  });
  Object.defineProperty(Location.prototype, 'href', {
    set(url) { log(url); return url; },
    get()    { return ''; }
  });

  /* window.open */
  const oOpen = window.open;
  window.open = function (u, ...rest) { log(u); return oOpen.call(this, u, ...rest); };

  /* history.push/replaceState */
  ['pushState', 'replaceState'].forEach(m => {
    const o = history[m];
    history[m] = function (...a) { log(location.href); return o.apply(this, a); };
  });

  /* клики по ссылкам */
  addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (a) log(a.href);
  }, true);
});           // ⬅ превращаем функцию в строку

/* ---------- REGEXP для статического поиска в JS-бандлах ------------------ */
const URL_RE  = /[a-z][\w+.-]*:\/\/[\w@%./#?+=~-]{6,}/gi;
const SKIP_RE = /^(https?|wss?|file|data:image)/i;

/* ---------- ОСНОВНАЯ ФУНКЦИЯ --------------------------------------------- */
(async () => {
  console.log('🟢  Launching Playwright …');

  const iphone  = devices[DEVICE] ?? devices['iPhone 13 Pro'];
  const browser = await chromium.launch({ headless: HEADLESS });
  const ctx     = await browser.newContext({ ...iphone, hasTouch: true });
  const page    = await ctx.newPage();

  /* — инъектируем сниффер в главный документ */
  await page.addInitScript({ content: `(${SNIF_SRC})()` });

  /* — инъектируем в новые фреймы */
  page.on('frameattached', f => {
    try {
      if (typeof f.addInitScript === 'function') {
        return f.addInitScript({ content: `(${SNIF_SRC})()` });
      }
      return f.evaluate(`(${SNIF_SRC})()`).catch(() => {});
    } catch {}
  });

  /* — статический разбор всех .js-ответов */
  const CANDS = new Set();
  page.on('response', async resp => {
    try {
      if (resp.request().resourceType() !== 'script') return;
      const txt = await resp.text();
      for (const m of txt.matchAll(URL_RE)) {
        const u = m[0];
        if (!SKIP_RE.test(u)) CANDS.add(u);
      }
    } catch {}
  });

  /* ---------- НАВИГАЦИЯ К СТРАНИЦЕ -------------------------------------- */
  await page.goto(URL, { waitUntil: 'networkidle' });

  /* ---------- КЛИК ПО КНОПКЕ «Оплатить» ---------------------------------- */
  console.log('🟢  looking for pay-button …');
  try {
    // XPath, который вы присылали
    await page.locator('xpath=//*[@id="app"]/main/div[2]/div[1]/button')
              .first().click({ timeout: 8000 });
    console.log('✅  pay-button clicked (XPath)');
  } catch {
    // fallback-эвристики
    const alt = await page.getByRole('button', { name: /pay|оплатить|sber pay/i }).first();
    if (await alt.count()) {
      await alt.click().catch(() => {});
      console.log('✅  pay-button clicked (heuristic)');
    } else {
      console.warn('⚠️  pay-button not found');
    }
  }

  /* ---------- ЖДЁМ, собираем ссылки ------------------------------------- */
  await page.waitForTimeout(TIMEOUT);
  if (!CANDS.size) {
    console.warn('⚠️  no links yet – waiting 20 s more …');
    await page.waitForTimeout(20000);
  }

  /* ---------- ВЫВОД РЕЗУЛЬТАТА ------------------------------------------ */
  const out = Array.from(CANDS).sort();
  if (OUT) {
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    console.log(`💾  saved ${out.length} link(s) → ${OUT}`);
  } else {
    console.log(JSON.stringify(out, null, 2));
  }

  if (HEADLESS) await browser.close();
  else {
    console.log('⏸  Done. Press Ctrl-C to exit.');
    await new Promise(() => {});        // держим окно открытым
  }
})();
