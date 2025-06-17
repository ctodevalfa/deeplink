/** Normalise phone/card */
export function normaliseAccount(value) {
  const clear = String(value).replace(/[^0-9]/g, '');
  return clear.startsWith('8') && clear.length === 11 ? '7' + clear.slice(1) : clear;
}

/** Normalise phone for desktop links */
export function normalizePhone(value) {
  return normaliseAccount(value);
}

/** Convert amount to cents */
export function toCents(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(',', '.'));
  return Math.round(num * 100);
}

/** Format «rubles.cents» без тысячных */
export function formatAmount(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(',', '.'));
  return num.toFixed(2);
}

/** Detect runtime platform (basic) */
export function detectPlatform() {
  if (typeof navigator === 'undefined') return 'android'; // SSR / Node → assume Android
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'android';
} 