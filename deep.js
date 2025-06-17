/**
 * sbpDeepLinks.js – helper for building P2P‑payment deeplinks for Russian bank apps (SBP/FPS).
 *
 * Supported banks:
 *   • ru_tinkoff            – Тинькофф Банк (много alias‑схем под iOS)
 *   • ru_sberbank           – СберБанк Онлайн
 *   • ru_sberbank_trans     – СберБанк – перевод за границу (transborder)
 *   • ru_vtb                – ВТБ Онлайн
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
      'sbolonline://abroadtransfers/foreignbank',
      'budgetonline-ios://sbolonline/abroadtransfers/foreignbank', 
      'ios-app-smartonline://sbolonline/abroadtransfers/foreignbank',
      'app-online-ios://abroadtransfers/foreignbank',
      'btripsexpenses://sbolonline/abroadtransfers/foreignbank',
      'sberbankonline://transfers/abroad/foreignbank',
      'bank100000000111://abroadtransfers/foreignbank'  // новая схема для трансграничных
    ];

    const androidSchemes = [
      'sberbankonline://transfers/abroad/foreignbank',
      'intent://ru.sberbankmobile/transfers/abroad/foreignbank',
      'android-app://ru.sberbankmobile/transfers/abroad/foreignbank',
      'intent://ru.sberbankmobile/android-app/transfers/abroad/foreignbank'
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

    if (platform === 'ios') {
      // Используем схемы в том порядке, как они работают у пользователя
      // sbolonline:// - проверенная рабочая схема идет первой
      const schemes = [
        'sbolonline',        // ✅ РАБОТАЕТ! Проверенная схема
        'sberbankonline',    // основная схема  
        'bank100000000111',  // новая схема для iOS
        'iosappsmartonline', // iOS Smart Online
        'budgetonline',      // Budget Online  
        'btripsexpenses'     // Business Trips
      ];
      
      const links = [];
      
      schemes.forEach(scheme => {
        if (isCard) {
          // Для карт - варианты из обфусцированного кода
          links.push(`${scheme}://p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
          links.push(`${scheme}://payments/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
        } else {
          // Для телефонов - варианты из обфусцированного кода  
          links.push(`${scheme}://payments/p2p-by-phone-number?phoneNumber=${phone}`);
          links.push(`${scheme}://payments/p2p?type=phone_number&requisiteNumber=${phone}`);
        }
      });
      
      // Добавляем комбинированные схемы из найденного кода
      if (isCard) {
        // Комбинированные схемы для карт
        links.push(`budgetonline-ios://sbolonline/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
        links.push(`ios-app-smartonline://sbolonline/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
        links.push(`app-online-ios://payments/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
        links.push(`btripsexpenses://sbolonline/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
      } else {
        // Комбинированные схемы для телефонов
        links.push(`budgetonline-ios://sbolonline/payments/p2p-by-phone-number?phoneNumber=${phone}`);
        links.push(`ios-app-smartonline://sbolonline/payments/p2p-by-phone-number?phoneNumber=${phone}`);
        links.push(`app-online-ios://payments/p2p-by-phone-number?phoneNumber=${phone}`);
        links.push(`btripsexpenses://sbolonline/payments/p2p-by-phone-number?phoneNumber=${phone}`);
      }
      
      return links;
    } else { // android
      const reqType = isCard ? 'card_number' : 'phone_number';
      const baseLink = `intent://ru.sberbankmobile/payments/p2p?type=${reqType}`
           + `&requisiteNumber=${phone}`
           + (isCard ? `&amount=${sum}` : '')
           + '#Intent;scheme=https;end';
      
      // Альтернативные схемы для Android
      const altLinks = [
        `sberbankonline://ru.sberbankmobile/payments/p2p?type=${reqType}&requisiteNumber=${phone}${isCard ? `&amount=${sum}` : ''}`,
        `android-app://ru.sberbankmobile/payments/p2p?type=${reqType}&requisiteNumber=${phone}${isCard ? `&amount=${sum}` : ''}`
      ];
      
      return [baseLink, ...altLinks];
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
  