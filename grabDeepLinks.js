/* ---------------------------------------------------------------------------
   sbpDeepLinks.js   –   универсальный генератор deep-link’ов под банки РФ/СНГ
   Экспортирует:
     • generateDeepLinks(opts)     → массив ссылок (mobile-flow, приоритеты)
     • generateDesktopLink(opts)   → https-URL для десктоп-браузера или null
     • deepHtmlAliasToScheme(key)  → мэппер alias → scheme (deep.html/?alias)
   ------------------------------------------------------------------------- */

   const DEFAULT_BANK = 'ru_sberbank';     // если не передали bank
   const PLATFORM =
     /iPhone|iPad|iPod/i.test(navigator?.userAgent ?? '') ? 'ios' :
     /Android/i.test(navigator?.userAgent ?? '')          ? 'android' :
     'desktop';
   
   /* ---------------------------------------------------------------------------
      Карта схем для каждого банка
      Для iOS массив alias-ов перебирается до первого успешного открытия,
      для Android обычно достаточно intent:// + android-app://
   --------------------------------------------------------------------------- */
   const BANK_SCHEMES = {
     /* ----- Сбербанк --------------------------------------------------------- */
     ru_sberbank: {
       ios: [
         'sberbankonline://',
         'sbolonline://',
         'ios-app-smartonline://',
         'budgetonline-ios://',
         'btripsexpenses://'
       ].map(base => ({
         phone: p => `${base}payments/p2p-by-phone-number?phoneNumber=${p}`,
         card : (c,a) => `${base}p2ptransfer?amount=${a}&isNeedToOpenNextScreen=true`
                       + `&skipContactsScreen=true&to=${c}&type=cardNumber`
       })),
       android: [
         (p) => `intent://ru.sberbankmobile/payments/p2p?type=phone_number`
              + `&requisiteNumber=${p}#Intent;scheme=https;end`,
         (c,a) => `intent://ru.sberbankmobile/payments/p2p?type=card_number`
                + `&requisiteNumber=${c}&amount=${a}#Intent;scheme=https;end`,
         (p) => `android-app://ru.sberbankmobile/payments/p2p?type=phone_number`
              + `&requisiteNumber=${p}`,
       ],
       foreign: {                      // «Перевод за рубеж»
         ios:   alias => `${alias}abroadtransfers/foreignbank`,
         android: () => 'intent://ru.sberbankmobile/transfers/abroad/foreignbank'
                       + '#Intent;scheme=https;end'
       }
     },
   
     /* ----- Тинькофф --------------------------------------------------------- */
     ru_tinkoff: {
       ios: [
         'tinkoffpay://',           'freelancecase://Main/',
         'tbank://Main/',           'yourmoney://Main/',
         'feedaways://Main/',       'toffice://Main/',
         'tguard://Main/',          'mobtrs://Main/',
         'goaloriented://Main/',    'tmydocs://Main/',
         'tfinstudy://Main/',       'tsplit://Main/',
         'tfinskills://Main/'
       ].map(prefix => ({
         phone: (p,a,member) => `${prefix}PayByMobileNumber?numberPhone=%2B${p}`
                               + `&amount=${a}${member ? '&bankMemberId='+member : ''}`,
         card : (c,a)         => `${prefix}Pay/C2C?amount=${a}&targetCardNumber=${c}`
                               + `&numberCard=${c}`
       })),
       android: [
         (p,a,m) => `intent://ru.tinkoff.payment/p2p?type=phone_number`
                  + `&phone=${p}&amount=${a}&memberId=${m}#Intent;scheme=https;end`,
         (c,a)   => `intent://ru.tinkoff.payment/p2p?type=card_number`
                  + `&card=${c}&amount=${a}#Intent;scheme=https;end`
       ]
     },
   
     /* ----- ВТБ -------------------------------------------------------------- */
     ru_vtb: {
       ios:   p => `https://online.vtb.ru/i/ppl/${p}`,          // откроется как Universal Link
       android: p => `https://online.vtb.ru/i/ppl/${p}`,
       transborder: ({ phone, countryIso='TJ', countryCode='73' }) =>
         `https://online.vtb.ru/i/phone/${countryIso}/${countryCode}/?phoneNumber=${phone}&deeplink=true`
     },
   
     /* ----- BirBank (Kapital Bank, AZ) -------------------------------------- */
     az_birbank: {
       ios:  p => `birbank://payments/p2p?phone=${p}`,
       android: p => `intent://az.kapitalbank.mobile/payments/p2p?phone=${p}`
                   + '#Intent;scheme=https;end'
     },
   
     /* ----- M10 (пилот) ------------------------------------------------------ */
     m10: {
       ios: p => `m10://p2p?phone=${p}`,
       android: p => `intent://m10/payments/p2p?phone=${p}#Intent;scheme=https;end`
     }
   };
   
   /* ---------------------------------------------------------------------------
      Вспомогательные утилиты
   --------------------------------------------------------------------------- */
   const toKopecks = v => Math.round(parseFloat(v) * 100);
   const normPhone = p => (p+'').replace(/[^\d]/g,'').replace(/^8/,'7');
   const isPhone   = s => /^\d{11}$/.test(s) && s.startsWith('79');
   const isCard    = s => /^\d{16}$/.test(s);
   
   /* ---------------------------------------------------------------------------
      Основной экспорт – generateDeepLinks
   --------------------------------------------------------------------------- */
   export function generateDeepLinks({
     phone,                // телефон либо номер карты
     amount  = 0,
     bank    = DEFAULT_BANK,
     bankMemberId,
     isTransborder = false,
     platform = PLATFORM,  // 'ios','android','desktop'
     countryIso,
     countryCode
   } = {}) {
     const result = [];
   
     const phoneN = normPhone(phone);
     const card   = phone;        // если это карта, не трогаем
   
     const sumKop = toKopecks(amount);
   
     const cfg = BANK_SCHEMES[bank];
     if (!cfg) return result;
   
     /* ---------- ВТБ transborder ------------------------------------------- */
     if (bank === 'ru_vtb' && isTransborder)
       return [ cfg.transborder({ phone: phoneN, countryIso, countryCode }) ];
   
     /* ---------- Сбер foreignbank ----------------------------------------- */
     if (bank === 'ru_sberbank' && isTransborder) {
       const aliases = BANK_SCHEMES.ru_sberbank.ios   // iOS-alias-массив
                         .map(o=>o.phone)             // берём base-scheme
                         .map(fn=>fn(''))             // → 'scheme://'
                         .map(s => s.replace(/\/payments.*$/i, '')); // чистим хвост
       if (platform === 'ios')
         return aliases.map(a => cfg.foreign.ios(a));
       return [ cfg.foreign.android() ];
     }
   
     /* ---------- Обычные P2P ---------------------------------------------- */
     if (platform === 'ios') {
       const arr = cfg.ios ?? [];
       arr.forEach(item => {
         if (isPhone(phoneN) && item.phone)
           result.push(item.phone(phoneN, sumKop, bankMemberId));
         else if (isCard(card) && item.card)
           result.push(item.card(card, sumKop, bankMemberId));
         else if (typeof item === 'function')
           result.push(item(phoneN, sumKop, bankMemberId));
       });
     } else if (platform === 'android') {
       const arr = cfg.android ?? [];
       arr.forEach(fn => {
         if (typeof fn === 'function')
           result.push(fn(isPhone(phoneN)?phoneN:card, sumKop, bankMemberId));
       });
     }
   
     return [...new Set(result)];      // убираем дубликаты
   }
   
   /* ---------------------------------------------------------------------------
      Десктоп-линк (browser-flow). Сейчас реальный только для ВТБ.
   --------------------------------------------------------------------------- */
   export function generateDesktopLink({
     phone,
     amount,
     bank = DEFAULT_BANK,
     isTransborder = false,
     countryIso,
     countryCode
   } = {}) {
     if (bank === 'ru_vtb') {
       if (isTransborder) {
         return BANK_SCHEMES.ru_vtb.transborder({
           phone: normPhone(phone),
           countryIso,
           countryCode
         });
       }
       return BANK_SCHEMES.ru_vtb.ios(normPhone(phone));  // универсальный link
     }
     return null;              // для Сбера/Тинькофф → QR СБП
   }
   
   /* ---------------------------------------------------------------------------
      deepHtmlAliasToScheme – маппинг alias из /deep.html?<alias>
   --------------------------------------------------------------------------- */
   const ALIAS_MAP = {
     sberbankonline:  'sberbankonline://',
     sbolonline:      'sberbankonline://',
     iosappsmartonline:'ios-app-smartonline://',
     budgetonline:    'budgetonline-ios://',
     btripsexpenses:  'btripsexpenses://',
     tinkoffpay:      'tinkoffpay://',
     birbank:         'birbank://',
     m10:             'm10://',
     noapp:           null
   };
   export const deepHtmlAliasToScheme = key => ALIAS_MAP[key] ?? null;
   
   /* ---------------------------------------------------------------------------
      CJS fallback (require) --------------------------------------------------- */
   export default { generateDeepLinks, generateDesktopLink, deepHtmlAliasToScheme };
   