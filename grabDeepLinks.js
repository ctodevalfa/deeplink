/* =========================================================================
   grabDeepLinks.js ― Rev 10 (17 Jun 2025)
   Вытягивает все deep-link URL-ы (intent://, sberbankonline:// …) из
   одностраничных платёжных страниц.
   ─ cli-параметры ──────────────────────────────────────────────────────────
     --out=<file>        сохранить результат в файл (JSON)
     --headless=false    показывать окно браузера (по умолчанию headless)
     --device="Pixel 7"  профиль устройства из Playwright.devices
     --timeout=30000     сколько мс ждать после клика (default 20000)
   ======================================================================= */

   import fs from 'node:fs';
   import { chromium, devices } from 'playwright';
   
   /* ---------- утилита для чтения флагов CLI -------------------------------- */
   function arg(key) {
     const found = process.argv.find(a => a.startsWith(key + '='));
     return found ? found.split('=').slice(1).join('=') : null;
   }
   
   /* ---------- входные параметры ------------------------------------------- */
   const URL       = process.argv[2];
   if (!URL) {
     console.error('Usage: node grabDeepLinks.js <url> [--out=file] [--headless=false] [--device="Pixel 7"] [--timeout=30000]');
     process.exit(1);
   }
   const OUTFILE   = arg('--out')       ?? null;
   const HEADLESS  = arg('--headless')  === 'false' ? false : true;
   const DEVICE    = arg('--device')    ?? 'iPhone 13 Pro';
   const TIME_WAIT = Number(arg('--timeout') ?? 20000);
   
   /* ---------- код-сниффер (инъектируется в каждый фрейм) ------------------ */
   const SNIF_SRC = String(() => {
     const seen = new Set();
     const log  = u => { if (!seen.has(u)) { seen.add(u); console.log('[DL]', u); } };
   
     /* location.href / assign / replace */
     ['assign', 'replace'].forEach(m => {
       const orig = Location.prototype[m];
       Location.prototype[m] = function (u) { log(u); return orig.call(this, u); };
     });
     Object.defineProperty(Location.prototype, 'href', {
       set(u) { log(u); return u; },
       get()  { return ''; }
     });
   
     /* window.open */
     const oldOpen = window.open;
     window.open = function (u, ...a) { log(u); return oldOpen.call(this, u, ...a); };
   
     /* history.* */
     ['pushState', 'replaceState'].forEach(m => {
       const orig = history[m];
       history[m] = function (...a) { log(location.href); return orig.apply(this, a); };
     });
   
     /* клики по ссылкам */
     addEventListener('click', e => {
       const a = e.target.closest('a[href]');
       if (a) log(a.href);
     }, true);
   }); // превращаем функцию в строку
   
   /* ---------- RegExp для поиска URL внутри скриптов ----------------------- */
   const URL_RE  = /[a-z][\w+.-]*:\/\/[\w@%./#?+=~-]{6,}/gi;
   const SKIP_RE = /^(https?|wss?|file|data:image)/i;
   
   /* ---------- основная асинхронная функция -------------------------------- */
   (async () => {
     console.log('🟢  Launching Playwright …');
     const iphone  = devices[DEVICE] ?? devices['iPhone 13 Pro'];
     const browser = await chromium.launch({ headless: HEADLESS });
     const ctx     = await browser.newContext({ ...iphone, hasTouch: true });
     const page    = await ctx.newPage();
   
     /* --- инъекция сниффера в главный документ --- */
     await page.addInitScript({ content: `(${SNIF_SRC})()` });
   
     /* --- инъекция в каждый новый фрейм --- */
     page.on('frameattached', f => {
       try {
         if (typeof f.addInitScript === 'function')
           return f.addInitScript({ content: `(${SNIF_SRC})()` });
         return f.evaluate(`(${SNIF_SRC})()`).catch(() => {});
       } catch {}
     });
   
     /* --- статический анализ всех .js-бандлов на лету --- */
     const found = new Set();
     page.on('response', async r => {
       if (r.request().resourceType() !== 'script') return;
       try {
         const txt = await r.text();
         for (const m of txt.matchAll(URL_RE)) {
           const url = m[0];
           if (!SKIP_RE.test(url)) found.add(url);
         }
       } catch {}
     });
   
     /* ----------- идём на страницу ---------------------------------------- */
     await page.goto(URL, { waitUntil: 'networkidle' });
   
     /* ----------- кликаем по кнопке оплаты -------------------------------- */
     console.log('🟢  looking for pay-button …');
     let clicked = false;
     try {
       await page.locator('xpath=//*[@id="app"]/main/div[2]/div[1]/button')
                 .first().click({ timeout: 8000 });
       console.log('✅  pay-button clicked (XPath)');
       clicked = true;
     } catch {}
   
     if (!clicked) {
       const alt = page.getByRole('button', { name: /pay|оплатить|sber pay/i }).first();
       if (await alt.count()) {
         await alt.click().catch(() => {});
         console.log('✅  pay-button clicked (heuristic)');
       } else console.warn('⚠️  pay-button not found');
     }
   
     /* ----------- ждём и собираем URL-ы ----------------------------------- */
     await page.waitForTimeout(TIME_WAIT);
     if (!found.size) {
       console.warn('⚠️  no links yet – waiting 20 s more …');
       await page.waitForTimeout(20000);
     }
   
     /* ----------- вывод результата ---------------------------------------- */
     const list = Array.from(found).sort();
     if (OUTFILE) {
       fs.writeFileSync(OUTFILE, JSON.stringify(list, null, 2));
       console.log(`💾  saved ${list.length} link(s) → ${OUTFILE}`);
     } else {
       console.log(JSON.stringify(list, null, 2));
     }
   
     if (HEADLESS) await browser.close();
     else {
       console.log('⏸  Done. Press Ctrl-C to exit.');
       await new Promise(() => {});             // держим окно открытым
     }
   })();
   