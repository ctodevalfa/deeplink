/**
 * ВТБ Банк - deeplinks генератор
 */

export function buildForVTB({ phone, isTransborder }) {
  const base = 'https://online.vtb.ru/i/';
  return [
    isTransborder
      ? `${base}phone/TJ/73/?phoneNumber=${phone}&deeplink=true`
      : `${base}ppl/${phone}`
  ];
} 