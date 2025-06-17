/**
 * СберБанк Онлайн - deeplinks генератор
 * Поддерживает: обычные переводы и трансграничные переводы
 */

export function buildForSber({ phone, amount, platform }) {
  const isCard  = /^\d{16}$/.test(phone);
  const isPhone = /^\d{11}$/.test(phone) && phone.startsWith('79');
  const sum     = Math.round(amount * 100);

  if (platform === 'ios') {
    // Порядок схем согласно рабочему коду
    const schemes = [
      'budgetonline-ios',    // ✅ Корпоративный СБОЛ
      'sbolonline',          // ✅ Базовая схема  
      'ios-app-smartonline', // ✅ Smart-версия
      'app-online-ios',      // ✅ Основная iOS схема
      'btripsexpenses'       // ✅ Travel-клиент
    ];
    
    const links = [];
    
    schemes.forEach(scheme => {
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
        // Для телефонов
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
    
    // Добавляем дополнительную схему для телефонов
    if (!isCard) {
      links.push(`sberbankonline://payments/p2p?type=phone_number&requisiteNumber=${phone}`);
    }
    
    return links;
  } else { 
    // Android логика
    const reqType = isCard ? 'card_number' : 'phone_number';
    const links = [];
    
    // Кроссплатформенные схемы (работают на Android)
    const crossPlatformSchemes = [
      'sberbankonline', 'sbolonline', 'ios-app-smartonline', 
      'budgetonline-ios', 'btripsexpenses', 'app-online-ios'
    ];
    
    crossPlatformSchemes.forEach(scheme => {
      if (isCard) {
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
    
    // Дополнительные Android схемы
    const additionalAndroidSchemes = ['bank100000000111'];
    
    additionalAndroidSchemes.forEach(scheme => {
      if (isCard) {
        links.push(`${scheme}://p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
        links.push(`${scheme}://payments/p2ptransfer?amount=${sum}&isNeedToOpenNextScreen=true&skipContactsScreen=true&to=${phone}&type=cardNumber`);
      } else {
        links.push(`${scheme}://payments/p2p-by-phone-number?phoneNumber=${phone}`);
        links.push(`${scheme}://payments/p2p?type=phone_number&requisiteNumber=${phone}`);
      }
    });
    
    // Intent-схемы для Android
    const intentLinks = [
      `intent://ru.sberbankmobile/payments/p2p?type=${reqType}&requisiteNumber=${phone}${isCard ? `&amount=${sum}` : ''}#Intent;scheme=https;end`,
      `android-app://ru.sberbankmobile/payments/p2p?type=${reqType}&requisiteNumber=${phone}${isCard ? `&amount=${sum}` : ''}`,
      `sberbankonline://payments/p2p?type=${reqType}&requisiteNumber=${phone}${isCard ? `&amount=${sum}` : ''}`
    ];
    
    links.push(...intentLinks);
    return links;
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