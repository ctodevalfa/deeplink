/* ---------------------------------------------------------------------------
   grabDeepLinks.js  –  Rev 9a  (17 Jun 2025)
   Высасывает все deep-link’и (intent://, sberbankonline:// …) из одностраничных
   платёжных сайтов.  Работает как:
     1. Эмулирует мобильный браузер через Playwright.
     2. Инъектирует «сниффер» в каждый фрейм (даже динамически появляющиеся).
     3. Ловит location.href / assign / replace, window.open, pushState / replaceState.
     4. Параллельно скачивает все .js-бандлы, ищет внутри строковые литералы
        с ://  (исключая http/https/ws/file/data:image) — выдёргивает схемы.
     5. Записывает итоговый Set ссылок в stdout либо в --out=<file>.
--------------------------------------------------------------------------- */

import fs from 'node:fs';
import { chromium, devices } from 'playwright';

/* ---------- CLI ---------------------------------------------------------------- */
const URL   = process.argv[2];
if (!URL) { console.error('Usage: node grabDeepLinks.js <url> [--out=file]'); process.exit(1); }

const OUT  = process.argv.find(a => a.startsWith('--out='))?.split('=')[1] ?? null;
const DEV  = process.argv.find(a => a.startsWith('--device='))?.split('=')[1] ?? 'iPhone 13 Pro';
const HEAD = process.argv.includes('--headless=false') ? false : true;
const TIME = Number(process.argv.find(a => a.startsWith('--timeout='))?.split('=')[1]) || 20000;

/* ---------- Sniffer-код, который втыкается в каждую страницу ------------------ */
const SNIF_SRC = `
(function(){
  const found = new Set();
  const log   = u=>{ if(!found.has(u)){ found.add(u); console.log('[DL]',u);} };

  /* Location.*  (href, assign, replace) */
  ['assign','replace'].forEach(m=>{
    const orig = Location.prototype[m];
    Location.prototype[m] = function(url){ log(url); try{ return orig.call(this,url);}catch(e){} };
  });
  Object.defineProperty(Location.prototype,'href',{
    set(url){ log(url); return url; },
    get(){ return ''; }
  });

  /* window.open */
  const oOpen = window.open;
  window.open = function(u){ log(u); return oOpen.apply(this,arguments); };

  /* history.push/replaceState */
  ['pushState','replaceState'].forEach(m=>{
    const o = history[m];
    history[m] = function(){ log(location.href); return o.apply(this,arguments); };
  });

  /* ловим клики по <a href> */
  addEventListener('click',e=>{
    const a = e.target.closest('a[href]');
    if(a) log(a.href);
  },true);
})();`;

/* ---------- Основная функция --------------------------------------------------- */
(async () => {
  const iphone = devices[DEV] ?? devices['iPhone 13 Pro'];
  const browser = await chromium.launch({ headless: HEAD });
  const ctx = await browser.newContext({ ...iphone, hasTouch: true });
  const page = await ctx.newPage();

  /* Инъекция сниффера в основной документ */
  await page.addInitScript({ content: SNIF_SRC });

  /* Инъекция в каждый attach-фрейм  ------------------------------------------- */
  page.on('frameattached', f => {
    try {
      if (typeof f.addInitScript === 'function') {
        return f.addInitScript({ content: SNIF_SRC });
      }
      // fallback для старых Playwright
      return f.evaluate(SNIF_SRC).catch(()=>{});
    } catch {}
  });

  /* Сохраняем все .js ответы и тут же сканируем их на deep-link строки -------- */
  const CANDS = new Set();
  const URL_RE = /[a-z][\\w+.-]*:\\/\\/[\\w@%./#?+=~-]{6,}/gi;
  const SKIP_RE = /^(https?|wss?|file|data:image)/i;

  page.on('response', async resp => {
    try {
      if (resp.request().resourceType() !== 'script') return;
      const body = await resp.text();
      for (const m of body.matchAll(URL_RE)) {
        const u = m[0];
        if (!SKIP_RE.test(u)) CANDS.add(u);
      }
    } catch {}
  });

  /* Навигация + клик по вашей кнопке  ---------------------------------------- */
  await page.goto(URL, { waitUntil: 'networkidle' });

  // специально указанная кнопка
  try {
    await page.locator('xpath=//*[@id="app"]/main/div[2]/div[1]/button')
             .first().click({ timeout: 5000 });
  } catch {}
  // запасные эвристики
  await page.click('text=/pay|оплатить/i').catch(()=>{});
  await page.click('text=/sber pay/i').catch(()=>{});

  await page.waitForTimeout(TIME);

  await browser.close();

  /* ---------- Вывод результата ---------------------------------------------- */
  const result = Array.from(CANDS).sort();
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  else     console.log(JSON.stringify(result, null, 2));
})();
