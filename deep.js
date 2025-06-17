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

    // Базовые параметры
    const basicParams = `?phone=${phone}&amount=${amount}`;
    
    // Экспериментальные параметры для Абхазии и Амрабанк
    const abkhaziaParams = [
      // Стандартные форматы
      `?country=AB&bank=AMRA&phone=${phone}&amount=${amount}`,
      `?countryCode=AB&bankCode=AMRA&recipient=${phone}&sum=${amount}`,
      `?destination=abkhazia&bank=amrabank&phoneNumber=${phone}&transferAmount=${amount}`,
      `?toCountry=AB&toBank=AMRA&toPhone=${phone}&money=${amount}`,
      `?region=abkhazia&institution=amra&contact=${phone}&value=${amount}`,
      `?target=AB&financial=AMRA&mobile=${phone}&cash=${amount}`,
      `?abroad=abkhazia&provider=amrabank&number=${phone}&rub=${amount}`,
      `?foreign=AB&entity=AMRA&tel=${phone}&rubles=${amount}`,
      
      // Форматы с BIC/SWIFT
      `?country=AB&bic=AMRAGEAA&phone=${phone}&amount=${amount}`,
      `?swift=AMRAGEAA&country=abkhazia&recipient=${phone}&sum=${amount}`,
      
      // Форматы с ID банка
      `?bankId=AMRA&countryId=AB&phoneNumber=${phone}&transferSum=${amount}`,
      `?institutionId=268&countryCode=AB&mobile=${phone}&value=${amount}`,
      
      // Полные названия
      `?country=abkhazia&bank=amrabank&recipientPhone=${phone}&amountRub=${amount}`,
      `?destination=georgia-abkhazia&institution=amra-bank&tel=${phone}&money=${amount}`,
      
      // Форматы с кодами валют
      `?country=AB&bank=AMRA&phone=${phone}&amount=${amount}&currency=RUB`,
      `?countryCode=AB&bankCode=AMRA&recipient=${phone}&sum=${amount}&curr=643`,
      
      // Альтернативные пути
      `/abkhazia/amrabank?phone=${phone}&amount=${amount}`,
      `/AB/AMRA?recipient=${phone}&sum=${amount}`,
      `/foreignbank/abkhazia?bank=amra&phone=${phone}&money=${amount}`
    ];
    
    if (platform === 'ios') {
      // Сначала пробуем базовые схемы с обычными параметрами
      const basicLinks = iosSchemes.map(scheme => `${scheme}${basicParams}`);
      
      // Затем экспериментальные варианты для основных схем
      const experimentalLinks = [];
      const mainSchemes = ['sbolonline://', 'bank100000000111://'];
      
      // Пробуем разные пути
      const experimentalPaths = [
        'abroadtransfers/foreignbank',
        'transfers/abroad/abkhazia',
        'international/transfer',
        'foreign/payment',
        'abroad/send',
        'transfer/international',
        'payments/abroad',
        'send/foreign'
      ];
      
      mainSchemes.forEach(baseScheme => {
        experimentalPaths.forEach(path => {
          abkhaziaParams.forEach(params => {
            if (params.startsWith('/')) {
              // Для альтернативных путей в параметрах
              experimentalLinks.push(`${baseScheme}abroadtransfers/foreignbank${params}`);
            } else {
              // Для query параметров
              experimentalLinks.push(`${baseScheme}${path}${params}`);
            }
          });
        });
      });
      
      return [...basicLinks, ...experimentalLinks];
    } else {
      return androidSchemes.map(scheme => `${scheme}${basicParams}`);
    }
  }
  
  function buildForSber({ phone, amount, platform }) {
    const amountQuery = `amount=${amount}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`;
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
        if (base === 'bank100000000111://') {
          // Для новой iOS схемы используем формат payments...
          return phone.length >= 16
            ? `${base}payments/p2p?${amountQuery}`
            : `${base}payments/p2p-by-phone-number?phoneNumber=${phone}&amount=${amount}`;
        }
        // Для основных схем используем проверенные форматы
        return phone.length >= 16
          ? `${base}p2ptransfer?${amountQuery}`
          : `${base}payments/p2p-by-phone-number?phoneNumber=${phone}&amount=${amount}`;
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
  