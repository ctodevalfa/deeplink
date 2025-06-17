/**
 * sbpDeepLinks.js – helper for building P2P‑payment deeplinks for Russian bank apps (SBP/FPS).
 *
 * Supported banks:
 *   • ru_tinkoff            – Тинькофф Банк (много alias‑схем под iOS)
 *   • ru_sberbank           – СберБанк Онлайн ✅ РАБОТАЕТ на iOS
 *   • ru_sberbank_trans     – СберБанк – перевод за границу (transborder)
 *   • ru_vtb                – ВТБ Онлайн
 */

import { normaliseAccount, formatAmount, detectPlatform, normalizePhone } from '../utils/helpers.js';
import { buildForTinkoff } from '../banks/tinkoff.js';
import { buildForVTB } from '../banks/vtb.js';
import { buildForSber, buildForSberTrans } from '../banks/sberbank.js';

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