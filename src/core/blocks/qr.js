// QR コード。画像（PNG）はエディタが作って onImageUpload でアップロードし、公開 URL を src に持つ。
// 出力は通常の画像と同じ（data URL は Gmail で表示されないため使わない）
import { s } from '../model/schema.js';
import { imageHtml, imageText } from './image.js';

/** @import { Block } from '../model/types.js' */

/**
 * @typedef {Object} QrValues
 * @property {string} content QR にする文字列（URL など。差し込み変数は使わない）
 * @property {number} size 表示サイズ（px、正方形）
 * @property {'L' | 'M' | 'Q' | 'H'} ecLevel 誤り訂正レベル
 * @property {number} margin 周りの余白（モジュール数）
 * @property {string} color
 * @property {string} backgroundColor
 * @property {string} src アップロードした PNG の URL
 * @property {string} alt
 * @property {string} href
 * @property {'left' | 'center' | 'right'} align
 * @property {string | null} generated src を作ったときの設定（qrSignature）。今の設定と違えば作り直しが必要
 * @property {Record<string, unknown> | null} uploadData onImageUpload が返した任意のデータ
 */

/**
 * 画像の見た目を決める設定の署名（作成後に変わったかを調べるため）
 * @param {Pick<QrValues, 'content' | 'size' | 'ecLevel' | 'margin' | 'color' | 'backgroundColor'>} v
 * @returns {string}
 */
export function qrSignature(v) {
  return JSON.stringify([v.content, v.size, v.ecLevel, v.margin, v.color, v.backgroundColor]);
}

/**
 * QR ブロックの画像の状態
 * @param {Block} block
 * @returns {'empty' | 'missing' | 'stale' | 'ok'} empty: 内容が空 / missing: 未作成 / stale: 作成後に設定が変わった
 */
export function qrStatus(block) {
  const v = /** @type {QrValues} */ (/** @type {unknown} */ (block.values));
  if (!v.content) return 'empty';
  if (!v.src) return 'missing';
  return v.generated === qrSignature(v) ? 'ok' : 'stale';
}

/** @param {string} value */
const isUrl = (value) => /^https?:\/\/\S+$/i.test(value.trim());

/** @type {import('./types.js').CoreBlockDef} */
export const qrBlock = {
  type: 'qr',
  defaults: () => ({
    content: '',
    size: 160,
    ecLevel: 'M',
    margin: 2,
    color: '#000000',
    backgroundColor: '#ffffff',
    src: '',
    alt: '',
    href: '',
    align: 'center',
    generated: null,
    uploadData: null,
  }),
  schema: s.object({
    content: s.string(),
    size: s.number({ min: 48, max: 600, integer: true }),
    ecLevel: s.oneOf(['L', 'M', 'Q', 'H']),
    margin: s.number({ min: 0, max: 8, integer: true }),
    color: s.color(),
    backgroundColor: s.color(),
    src: s.string(),
    alt: s.string(),
    href: s.string(),
    align: s.oneOf(['left', 'center', 'right']),
    generated: s.string({ nullable: true }),
    uploadData: s.record({ nullable: true }),
  }),
  mergeTagFields: ['alt', 'href'],
  cellAlign: (block) => /** @type {any} */ (block.values.align),

  renderHtml(block, ctx) {
    const v = /** @type {QrValues} */ (/** @type {unknown} */ (block.values));
    if (!v.src) return [];
    const width = Math.max(1, Math.min(v.size, ctx.width));
    return [
      imageHtml({
        src: v.src,
        alt: v.alt,
        href: v.href,
        width,
        naturalWidth: 1,
        naturalHeight: 1,
        align: v.align,
      }),
    ];
  },

  renderText(block) {
    const v = /** @type {QrValues} */ (/** @type {unknown} */ (block.values));
    if (!v.src) return '';
    // テキストパートでは QR を読めないので、リンク先（無ければ QR の内容の URL）を出す
    const href = v.href || (isUrl(v.content) ? v.content.trim() : '');
    return imageText({ src: v.src, alt: v.alt, href });
  },
};
