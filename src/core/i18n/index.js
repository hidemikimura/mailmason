// 辞書差し替え式の i18n。辞書に無いキーは英語 → キーそのものの順でフォールバックする
import en from './en.js';
import ja from './ja.js';

/** @type {Record<string, Record<string, string>>} */
export const MESSAGES = { ja, en };

/**
 * @param {string} locale
 * @param {string} key
 * @param {Record<string, string | number>} [params] `{name}` 形式の差し込み
 * @param {Record<string, string>} [overrides] 利用者による部分上書き
 * @returns {string}
 */
export function translate(locale, key, params = {}, overrides = {}) {
  const message = overrides[key] ?? MESSAGES[locale]?.[key] ?? MESSAGES.en[key] ?? key;
  return message.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}
