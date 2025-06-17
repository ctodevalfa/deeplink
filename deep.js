/**
 * sbpDeepLinks.js – helper for building P2P‑payment deeplinks for Russian bank apps (SBP/FPS).
 *
 * Supported banks:
 *   • ru_tinkoff            – Тинькофф Банк (много alias‑схем под iOS)
 *   • ru_sberbank           – СберБанк Онлайн ✅ РАБОТАЕТ на iOS
 *   • ru_sberbank_trans     – СберБанк – перевод за границу (transborder)
 *   • ru_vtb                – ВТБ Онлайн
 *
 * ✅ ПРОВЕРЕННЫЕ РАБОЧИЕ СХЕМЫ:
 *   • ios-app-smartonline://sbolonline/payments/p2p-by-phone-number?phoneNumber=79991234567
 *   • sbolonline://payments/p2p-by-phone-number?phoneNumber=79991234567
 *   
 * ❗ ОГРАНИЧЕНИЯ:
 *   • СберБанк iOS: номер телефона подставляется ✅, сумма НЕ подставляется ❌
 *   • СберБанк Android: используются Intent-схемы с #Intent;scheme=https;end
 *   • Пользователю нужно вручную ввести сумму в приложении
 *
 * API
 *   generateDeepLinks({
 *     phone: string,          // «+7…» или 16‑значный номер карты
 *     amount: number|string,  // сумма ₽ (например 1107.00)
 *     bank: 'ru_tinkoff' | 'ru_sberbank' | 'ru_sberbank_trans' | 'ru_vtb',
 *     bankMemberId?: string,  // для Тинькофф остаётся в query
 *     isTransborder?: boolean,// для ВТБ / Сбер влияет на ссылку
 *     platform?: 'ios'|'android' // если не указана — автоопределение по User‑Agent
 *   }): string[]
 *
 * Возвращает упорядоченный массив deeplink‑ов; клиент перебирает пока один не откроется.
 */

/** Normalise phone/card */
function normaliseAccount(value) {
    const clear = String(value).replace(/[^0-9]/g, '');
    return clear.startsWith('8') && clear.length === 11 ? '7' + clear.slice(1) : clear;
  }

/** Normalise phone for desktop links */
function normalizePhone(value) {
    return normaliseAccount(value);
  }

/** Convert amount to cents */
function toCents(amount) {
    const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(',', '.'));
    return Math.round(num * 100);
  }
  
  /** Format «rubles.cents» без тысячных */
  function formatAmount(amount) {
    const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(',', '.'));
    return num.toFixed(2);
  }
  
  /** Detect runtime platform (basic) */
  function detectPlatform() {
    if (typeof navigator === 'undefined') return 'android'; // SSR / Node → assume Android
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'android';
  }
  
  /** Build deeplinks per‑bank */
  function buildForTinkoff({ phone, amount, bankMemberId = '10076' }) {
    const schemes = [
      'freelancecase', 'yourmoney', 'tinkoffbank', 'tbank', 'feedaways', 'toffice', 'tguard',
      'mobtrs', 'goaloriented', 'tmydocs', 'tfinstudy', 'tsplit', 'tfinskills', 'bank100000000004'
    ];
    return schemes.map(s => {
      const prefix = `${s}://Main/`;
      return phone.length < 16
        ? `${prefix}PayByMobileNumber?numberPhone=%2B${phone}&amount=${amount}&bankMemberId=${bankMemberId}`
        : `${prefix}Pay/C2C?amount=${amount}&targetCardNumber=${phone}&numberCard=${phone}`;
    });
  }
  
  function buildForVTB({ phone, isTransborder }) {
    const base = 'https://online.vtb.ru/i/';
    return [
      isTransborder
        ? `${base}phone/TJ/73/?phoneNumber=${phone}&deeplink=true`
        : `${base}ppl/${phone}`
    ];
  }
  
  function buildForSberTrans({ phone, amount, platform }) {
    const iosSchemes = [
      'ios-app-smartonline://sbolonline/abroadtransfers/foreignbank',  // проверенная рабочая схема
      'budgetonline-ios://sbolonline/abroadtransfers/foreignbank',     // ✅ РАБОТАЕТ! Подтверждено пользователем
      'sbolonline://abroadtransfers/foreignbank',
      'sberbankonline://transfers/abroad/foreignbank',
      'bank100000000111://abroadtransfers/foreignbank'
    ];

    const androidSchemes = [
      // ✅ Главная Android Intent-схема из документации  
      'intent://ru.sberbankmobile/transfers/abroad/foreignbank#Intent;scheme=https;end',
      
      // Кроссплатформенные alias-схемы (работают на Android)
      'budgetonline-ios://sbolonline/abroadtransfers/foreignbank',
      'sbolonline://abroadtransfers/foreignbank', 
      'ios-app-smartonline://sbolonline/abroadtransfers/foreignbank',
      'app-online-ios://abroadtransfers/foreignbank',
      'btripsexpenses://sbolonline/abroadtransfers/foreignbank',
      'sberbankonline://abroadtransfers/foreignbank',
      
      // Дополнительные Android схемы
      'android-app://ru.sberbankmobile/transfers/abroad/foreignbank'
    ];

    // Пробуем добавить параметры для трансграничных переводов
    const params = `?phone=${phone}&amount=${amount}`;
    
    if (platform === 'ios') {
      return iosSchemes.map(scheme => `${scheme}${params}`);
    } else {
      return androidSchemes.map(scheme => `${scheme}${params}`);
    }
  }
  
  function buildForSber({ phone, amount, platform }) {
    // Оригинальная инсайд логика точно как в источнике
    const isCard  = /^\d{16}$/.test(phone);
    const isPhone = /^\d{11}$/.test(phone) && phone.startsWith('79');
    const sum     = Math.round(amount * 100);
    
    console.log(`🔍 buildForSber DEBUG:`, {
      phone,
      isCard,
      isPhone,
      platform,
      phoneLength: phone.length,
      phoneStartsWith79: phone.startsWith('79')
    });

    if (platform === 'ios') {
      // Порядок схем согласно оригинальному обфусцированному коду из 3333/
      const schemes = [
        'budgetonline-ios',    // ✅ budgetonline-ios://sbolonline/ - первая в оригинале
        'sbolonline',          // ✅ sbolonline://payments/ - вторая в оригинале  
        'ios-app-smartonline', // ✅ ios-app-smartonline://sbolonline/ - третья в оригинале
        'app-online-ios',      // ✅ app-online-ios://payments/ - четвертая в оригинале
        'btripsexpenses'       // ✅ btripsexpenses://sbolonline/ - пятая в оригинале
      ];
      
      const links = [];
      
      // Точная логика согласно оригинальному обфусцированному коду
      schemes.forEach((scheme, index) => {
        console.log(`🔗 Обрабатываем схему ${index + 1}/5: ${scheme}, isCard: ${isCard}`);
        
        // Формируем URL согласно оригинальному обфусцированному коду
        if (isCard) {
          // Для карт: p2ptransfer с параметрами
          if (scheme === 'budgetonline-ios') {
            links.push(`${scheme}://sbolonline/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
          } else if (scheme === 'sbolonline') {
            links.push(`${scheme}://payments/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
          } else if (scheme === 'ios-app-smartonline') {
            links.push(`${scheme}://sbolonline/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
          } else if (scheme === 'app-online-ios') {
            links.push(`${scheme}://payments/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
          } else if (scheme === 'btripsexpenses') {
            links.push(`${scheme}://sbolonline/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
          }
        } else {
          // Для телефонов: точные пути согласно оригинальному коду
          if (scheme === 'budgetonline-ios') {
            links.push(`${scheme}://sbolonline/payments/p2p-by-phone-number?phoneNumber=${phone}`);
          } else if (scheme === 'sbolonline') {
            links.push(`${scheme}://payments/p2p-by-phone-number?phoneNumber=${phone}`);
          } else if (scheme === 'ios-app-smartonline') {
            links.push(`${scheme}://sbolonline/payments/p2p-by-phone-number?phoneNumber=${phone}`);
          } else if (scheme === 'app-online-ios') {
            links.push(`${scheme}://payments/p2p-by-phone-number?phoneNumber=${phone}`);
          } else if (scheme === 'btripsexpenses') {
            links.push(`${scheme}://sbolonline/payments/p2p-by-phone-number?phoneNumber=${phone}`);
          }
        }
              });
      
      // Добавляем дополнительную схему согласно оригинальному коду
      if (!isCard) {
        // Для телефонов - добавляем sberbankonline схему как в оригинале
        links.push(`sberbankonline://payments/p2p?type=phone_number&requisiteNumber=${phone}`);
        console.log(`➕ Добавлена дополнительная схема sberbankonline`);
      }
      
      console.log(`🏁 buildForSber iOS возвращает ${links.length} ссылок:`, links);
      return links;
    } else { // android
      const reqType = isCard ? 'card_number' : 'phone_number';
      const links = [];
      
      // Добавляем схемы из документации и оригинального обфусцированного кода для Android
      // Включаем iOS-схемы которые работают и на Android
      const crossPlatformSchemes = [
        'sberbankonline',      // основная схема из документации
        'sbolonline',          // базовая схема из документации  
        'ios-app-smartonline', // iosappsmartonline из документации (работающая схема)
        'budgetonline-ios',    // budgetonline из документации (корпоративный СБОЛ)
        'btripsexpenses',      // btripsexpenses из документации (travel-клиент)
        'app-online-ios'       // дополнительная схема из оригинального кода
      ];
      
      // Добавляем кроссплатформенные схемы (работают и на Android)
      crossPlatformSchemes.forEach(scheme => {
        if (isCard) {
          // Для карт
          if (scheme === 'ios-app-smartonline') {
            links.push(`${scheme}://sbolonline/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
          } else if (scheme === 'budgetonline-ios' || scheme === 'btripsexpenses') {
            links.push(`${scheme}://sbolonline/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
          } else if (scheme === 'app-online-ios') {
            links.push(`${scheme}://payments/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
          } else {
            links.push(`${scheme}://payments/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
          }
        } else {
          // Для телефонов
          if (scheme === 'ios-app-smartonline') {
            links.push(`${scheme}://sbolonline/payments/p2p-by-phone-number?phoneNumber=${phone}`);
          } else if (scheme === 'budgetonline-ios' || scheme === 'btripsexpenses') {
            links.push(`${scheme}://sbolonline/payments/p2p-by-phone-number?phoneNumber=${phone}`);
          } else if (scheme === 'app-online-ios') {
            links.push(`${scheme}://payments/p2p-by-phone-number?phoneNumber=${phone}`);
          } else {
            links.push(`${scheme}://payments/p2p-by-phone-number?phoneNumber=${phone}`);
          }
        }
      });
      
      // Добавляем дополнительные Android схемы 
      const additionalAndroidSchemes = [
        'bank100000000111'     // дополнительная новая схема
      ];
      
      additionalAndroidSchemes.forEach(scheme => {
        if (isCard) {
          links.push(`${scheme}://p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
          links.push(`${scheme}://payments/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
        } else {
          links.push(`${scheme}://payments/p2p-by-phone-number?phoneNumber=${phone}`);
          links.push(`${scheme}://payments/p2p?type=phone_number&requisiteNumber=${phone}`);
        }
      });
      
      // Добавляем intent-схемы согласно документации
      const intentLinks = [
        // ✅ Главная Intent-схема из документации (с правильным завершением)
        `intent://ru.sberbankmobile/payments/p2p?type=${reqType}&requisiteNumber=${phone}${isCard ? `&amount=${sum}` : ''}#Intent;scheme=https;end`,
        
        // Дополнительные Android схемы
        `android-app://ru.sberbankmobile/payments/p2p?type=${reqType}&requisiteNumber=${phone}${isCard ? `&amount=${sum}` : ''}`,
        `sberbankonline://payments/p2p?type=${reqType}&requisiteNumber=${phone}${isCard ? `&amount=${sum}` : ''}`
      ];
      
      links.push(...intentLinks);
      
      return links;
    }
  }
  
  const BANK_BUILDERS = {
    ru_tinkoff: buildForTinkoff,
    ru_vtb: buildForVTB,
    ru_sberbank_trans: buildForSberTrans,
    ru_sberbank: buildForSber
  };
  
  /**
   * generateDeepLinks – public API
   */
  export function generateDeepLinks({ phone, amount, bank, bankMemberId, isTransborder = false, platform }) {
    const acct = normaliseAccount(phone);
    const amt = formatAmount(amount);
    const plt = platform || detectPlatform();
  
    const builder = BANK_BUILDERS[bank];
    if (!builder) throw new Error(`Unsupported bank code: ${bank}`);
  
    const params = { phone: acct, amount: amt, bankMemberId, isTransborder, platform: plt };
    const links = builder(params);
  
    // Deduplicate in case builder returns repeats
    return Array.from(new Set(links));
  }

  /////////////////////////////////////////////////////////////////////////
  // 2. DESKTOP (HTTPS) LINKS
  /////////////////////////////////////////////////////////////////////////

  /**
   * generateDesktopLink – возвращает HTTPS‑URL, пригодный для открытия на ПК,
   * или null, если банк не предоставляет web‑форму.
   */
  export function generateDesktopLink({ phone, bank, isTransborder }) {
    const p = normalizePhone(phone);
    switch (bank) {
      case "ru_vtb":
        return `https://online.vtb.ru/i/${isTransborder === "true" || isTransborder === true ? `phone/TJ/73/?phoneNumber=${p}&deeplink=true` : `ppl/${p}`}`;
      // Сбер и Тинькофф web‑форм не предоставляют – возвращаем null, чтобы фронт показал QR.
      default:
        return null;
    }
  }


  
  export default generateDeepLinks;
  