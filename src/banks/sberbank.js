/**
 * СберБанк Онлайн - deeplinks генератор
 * Поддерживает: обычные переводы и трансграничные переводы
 */

export function buildForSber({ phone, amount, platform }) {
  const isCard = phone.length >= 16;
  const normalizedPhone = phone.replace(/^\+/, ''); // убираем + если есть
  const sum = Math.round(amount * 100); // в копейки
  
  if (platform === 'ios') {
    return [
      // 1. budgetonline-ios
      `budgetonline-ios://sbolonline/${isCard ? 
        `p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${normalizedPhone}&type=cardNumber` : 
        `payments/p2p-by-phone-number?phoneNumber=${normalizedPhone}&amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true`}`,
      
      // 2. sbolonline  
      `sbolonline://payments/${isCard ? 
        `p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${normalizedPhone}&type=cardNumber}` : 
        `p2p-by-phone-number?phoneNumber=${normalizedPhone}&amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true`}`,
      
      // 3. ios-app-smartonline
      `ios-app-smartonline://sbolonline/${isCard ? 
        `p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${normalizedPhone}&type=cardNumber` : 
        `payments/p2p-by-phone-number?phoneNumber=${normalizedPhone}&amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true`}`,
      
      // 4. app-online-ios
      `app-online-ios://payments/${isCard ? 
        `p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${normalizedPhone}&type=cardNumber}` : 
        `p2p-by-phone-number?phoneNumber=${normalizedPhone}&amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true`}`,
      
      // 5. btripsexpenses
      `btripsexpenses://sbolonline/${isCard ? 
        `p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${normalizedPhone}&type=cardNumber` : 
        `payments/p2p-by-phone-number?phoneNumber=${normalizedPhone}&amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true`}`,
      
      // 6. sberbankonline (дополнительная схема)
      `sberbankonline://payments/p2p?type=phone_number&requisiteNumber=${normalizedPhone}&amount=${sum}`
    ];
  } else {
    // Android
    return [
      `intent://ru.sberbankmobile/payments/p2p?type=phone_number&requisiteNumber=${normalizedPhone}#Intent;scheme=https;end`,
      `android-app://ru.sberbankmobile/payments/p2p?type=phone_number&requisiteNumber=${normalizedPhone}`,
      `intent://ru.sberbankmobile/android-app/payments/p2p?type=phone_number&requisiteNumber=${normalizedPhone}#Intent;scheme=https;end`,
      `sberbankonline://payments/p2p?type=phone_number&requisiteNumber=${normalizedPhone}`
    ];
  }
}

export function buildForSberTrans({ phone, amount, platform }) {
  const iosSchemes = [
    'ios-app-smartonline://sbolonline/abroadtransfers/foreignbank',
    'budgetonline-ios://sbolonline/abroadtransfers/foreignbank',
    'sbolonline://abroadtransfers/foreignbank',
    'sberbankonline://transfers/abroad/foreignbank',
    'bank100000000111://abroadtransfers/foreignbank'
  ];

  const androidSchemes = [
    'intent://ru.sberbankmobile/transfers/abroad/foreignbank#Intent;scheme=https;end',
    'budgetonline-ios://sbolonline/abroadtransfers/foreignbank',
    'sbolonline://abroadtransfers/foreignbank', 
    'ios-app-smartonline://sbolonline/abroadtransfers/foreignbank',
    'app-online-ios://abroadtransfers/foreignbank',
    'btripsexpenses://sbolonline/abroadtransfers/foreignbank',
    'sberbankonline://abroadtransfers/foreignbank',
    'android-app://ru.sberbankmobile/transfers/abroad/foreignbank'
  ];

  const params = `?phone=${phone}&amount=${amount}`;
  
  if (platform === 'ios') {
    return iosSchemes.map(scheme => `${scheme}${params}`);
  } else {
    return androidSchemes.map(scheme => `${scheme}${params}`);
  }
} 