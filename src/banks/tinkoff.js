/**
 * Тинькофф Банк - deeplinks генератор
 */

export function buildForTinkoff({ phone, amount, bankMemberId = '10076' }) {
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