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
    const iosSchemes = [
      'sbolonline://',                    // основная - самая надежная
      'sberbankonline://',               // alias, встречается в старых версиях
      'budgetonline-ios://sbolonline/',
      'ios-app-smartonline://sbolonline/',
      'app-online-ios://',
      'btripsexpenses://sbolonline/',
      'bank100000000111://'              // новая схема в конце
    ];
  
    const androidSchemes = [
      'sberbankonline://payments/p2p?type=phone_number&requisiteNumber=', // native custom scheme
      'intent://ru.sberbankmobile/payments/p2p?type=phone_number&requisiteNumber=',
      'android-app://ru.sberbankmobile/payments/p2p?type=phone_number&requisiteNumber=',
      'android-app://ru.sberbankmobile/payments/p2p?type=card_number&requisiteNumber=', // новая схема для Android (для карт)
      'intent://ru.sberbankmobile/android-app/payments/p2p?type=phone_number&requisiteNumber='
    ];
  
    if (platform === 'ios') {
      return iosSchemes.map(base => {
        // Для телефонов используем p2p-by-phone-number
        if (phone.length < 16) {
          return `${base}payments/p2p-by-phone-number?phoneNumber=${phone}&amount=${amount}`;
        } else {
          // Для карт используем p2ptransfer с полными параметрами
          return `${base}p2ptransfer?amount=${amount}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`;
        }
      });
    }
    // android – добавляем сумму и правильный тип
    return androidSchemes.map(base => {
      // Определяем правильный тип для схемы
      if (base.includes('type=card_number') && phone.length < 16) {
        // Если схема для карт, но передан телефон - меняем тип
        base = base.replace('type=card_number', 'type=phone_number');
      } else if (base.includes('type=phone_number') && phone.length >= 16) {
        // Если схема для телефонов, но передана карта - меняем тип
        base = base.replace('type=phone_number', 'type=card_number');
      }
      return `${base}${phone}&amount=${amount}`;
    });
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
  