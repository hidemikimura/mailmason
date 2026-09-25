// Web フォントの候補と、端末のフォントの候補。キャンバスで表示するために document に CSS を読み込む
import { defaultBodySettings, WEB_FONT_URL } from '../core/model/settings.js';
import { fontFamilyNames } from '../core/render-html/web-fonts.js';

/** @import { WebFont } from '../core/model/types.js' */

/**
 * Web フォントの候補（設定欄の「Web フォントを追加」に出す）
 * @typedef {Object} WebFontOption
 * @property {string} family フォント名
 * @property {string} url CSS の URL（https）
 * @property {string} [fallback] 読み込めないメールソフトで使う端末のフォント（font-family の後ろに付ける）
 * @property {import('../core/blocks/custom.js').Label} [group] 候補の一覧での見出し（文字列か { ja, en }。無い候補は「その他」）
 */

/**
 * 端末のフォントの候補
 * @typedef {{ labelKey: string, value: string }} SystemFont
 */

const JA_SANS = "'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif";
const JA_SERIF = "'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, serif";
const LATIN_SANS = "'Helvetica Neue', Arial, sans-serif";
const LATIN_SERIF = "Georgia, 'Times New Roman', serif";

/**
 * @param {string} family
 * @param {string} weights 例: ':wght@400;700'（1 種類しか無いフォントは空）
 */
const google = (family, weights) =>
  `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}${weights}&display=swap`;

/**
 * @param {{ ja: string, en: string }} group
 * @param {string} fallback
 * @param {Array<[string, string]>} fonts フォント名と太さ
 * @returns {WebFontOption[]}
 */
const groupOf = (group, fallback, fonts) =>
  fonts.map(([family, weights]) => ({ family, url: google(family, weights), fallback, group }));

const BOLD = ':wght@400;700';

/** 既定の候補（Google Fonts） */
export const DEFAULT_WEB_FONT_OPTIONS = Object.freeze([
  ...groupOf({ ja: '日本語（ゴシック体）', en: 'Japanese (sans-serif)' }, JA_SANS, [
    ['Noto Sans JP', BOLD],
    ['M PLUS 1p', BOLD],
    ['M PLUS Rounded 1c', BOLD],
    ['Zen Kaku Gothic New', BOLD],
    ['Zen Maru Gothic', BOLD],
    ['BIZ UDPGothic', BOLD],
    ['Kosugi Maru', ''],
    ['Sawarabi Gothic', ''],
  ]),
  ...groupOf({ ja: '日本語（明朝体）', en: 'Japanese (serif)' }, JA_SERIF, [
    ['Noto Serif JP', BOLD],
    ['Shippori Mincho', BOLD],
    ['Zen Old Mincho', BOLD],
    ['BIZ UDPMincho', ''],
    ['Sawarabi Mincho', ''],
  ]),
  ...groupOf({ ja: '欧文（サンセリフ）', en: 'Latin (sans-serif)' }, LATIN_SANS, [
    ['Roboto', BOLD],
    ['Open Sans', BOLD],
    ['Lato', BOLD],
    ['Montserrat', BOLD],
    ['Poppins', BOLD],
    ['Inter', BOLD],
  ]),
  ...groupOf({ ja: '欧文（セリフ）', en: 'Latin (serif)' }, LATIN_SERIF, [
    ['Playfair Display', BOLD],
    ['Merriweather', BOLD],
  ]),
]);

/** 端末のフォントの候補 */
export const SYSTEM_FONTS = Object.freeze([
  { labelKey: 'font.systemSans', value: defaultBodySettings().fontFamily },
  {
    labelKey: 'font.systemSerif',
    value: "'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, 'MS PMincho', serif",
  },
  { labelKey: 'font.systemArial', value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { labelKey: 'font.systemGeorgia', value: LATIN_SERIF },
  { labelKey: 'font.systemVerdana', value: 'Verdana, Geneva, sans-serif' },
]);

/**
 * font-family の値の CSS 用の書き方（名前は引用符で囲む）
 * @param {string} family
 */
export const quoteFamily = (family) => `'${family.replace(/['\\]/g, '')}'`;

/**
 * Web フォントを先頭にした font-family。後ろには候補の端末のフォント（無ければ日本語のゴシック体）を付ける
 * @param {string} family
 * @param {readonly WebFontOption[]} options
 */
export function webFontStack(family, options) {
  const option = options.find((o) => o.family.toLowerCase() === family.toLowerCase());
  return `${quoteFamily(family)}, ${option?.fallback ?? JA_SANS}`;
}

/**
 * font-family の先頭が登録した Web フォントなら、その Web フォント
 * @param {string | null | undefined} value
 * @param {readonly WebFont[]} fonts
 * @returns {WebFont | null}
 */
export function leadingWebFont(value, fonts) {
  if (typeof value !== 'string') return null;
  const [first] = fontFamilyNames(value);
  return fonts.find((font) => font.family.trim().toLowerCase() === first) ?? null;
}

/**
 * font-family の、Web フォントを読み込めないときに使う部分（先頭の Web フォントを除いたもの）
 * @param {string} value
 */
export function fallbackOf(value) {
  return value.split(',').slice(1).join(',').trim();
}

/** URL として使えるか（https のみ） */
export const isWebFontUrl = (/** @type {string} */ url) => WEB_FONT_URL.test(url);

/** @type {Map<string, Set<object>>} 読み込んだ CSS の URL と、それを使うエディタ */
const loaded = new Map();

/**
 * キャンバスで表示するため、Web フォントの CSS を document に読み込む（@font-face は document に置くとシャドウ DOM でも使える）。
 * owner が使わなくなった CSS は、ほかのエディタも使っていなければ外す
 * @param {object} owner エディタ
 * @param {readonly WebFont[]} fonts
 */
export function syncDocumentFonts(owner, fonts) {
  if (typeof document === 'undefined') return;
  const urls = new Set(fonts.map((font) => font.url).filter(isWebFontUrl));
  for (const url of urls) {
    let users = loaded.get(url);
    if (!users) {
      users = new Set();
      loaded.set(url, users);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.dataset.mailmasonWebFont = '';
      document.head.append(link);
    }
    users.add(owner);
  }
  for (const [url, users] of loaded) {
    if (urls.has(url) || !users.delete(owner) || users.size > 0) continue;
    loaded.delete(url);
    for (const link of document.head.querySelectorAll('link[data-mailmason-web-font]')) {
      if (/** @type {HTMLLinkElement} */ (link).href === url || link.getAttribute('href') === url) {
        link.remove();
      }
    }
  }
}
