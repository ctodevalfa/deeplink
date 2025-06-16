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
      'mobtrs', 'goaloriented', 'tmydocs', 'tfinstudy', 'tsplit', 'tfinskills'
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
  
  function buildForSberTrans() {
    return [
      'budgetonline-ios://sbolonline/abroadtransfers/foreignbank',
      'sbolonline://abroadtransfers/foreignbank',
      'ios-app-smartonline://sbolonline/abroadtransfers/foreignbank',
      'app-online-ios://abroadtransfers/foreignbank',
      'btripsexpenses://sbolonline/abroadtransfers/foreignbank',
      'intent://ru.sberbankmobile/transfers/abroad/foreignbank',
      'android-app://ru.sberbankmobile/transfers/abroad/foreignbank',
      'intent://ru.sberbankmobile/android-app/transfers/abroad/foreignbank',
      'sberbankonline://transfers/abroad/foreignbank'
    ];
  }
  
  function buildForSber({ phone, amount, platform }) {
    const amountQuery = `amount=${amount}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`;
    const iosSchemes = [
      'sbolonline://',                    // основная
      'sberbankonline://',               // alias, встречается в старых версиях
      'budgetonline-ios://sbolonline/',
      'ios-app-smartonline://sbolonline/',
      'app-online-ios://',
      'btripsexpenses://sbolonline/'
    ];
  
    const androidSchemes = [
      'sberbankonline://payments/p2p?type=phone_number&requisiteNumber=', // native custom scheme
      'intent://ru.sberbankmobile/payments/p2p?type=phone_number&requisiteNumber=',
      'android-app://ru.sberbankmobile/payments/p2p?type=phone_number&requisiteNumber=',
      'intent://ru.sberbankmobile/android-app/payments/p2p?type=phone_number&requisiteNumber='
    ];
  
    if (platform === 'ios') {
      return iosSchemes.map(base =>
        phone.length >= 16
          ? `${base}p2ptransfer?${amountQuery}`
          : `${base}payments/p2p-by-phone-number?phoneNumber=${phone}&amount=${amount}`
      );
    }
    // android – добавляем сумму
    return androidSchemes.map(base => `${base}${phone}&amount=${amount}`);
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
  
  export default generateDeepLinks;
  