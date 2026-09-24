// インライン CSS の組み立てとスタイルの継承解決
import { escapeAttr } from '../richtext/entities.js';

/** @import { BodySettings, Spacing } from '../model/types.js' */

/**
 * 宣言を連結して style 属性の値にする（空の宣言は除く）
 * @param {...(string | false | null | undefined)} decls 'prop:value' 形式
 * @returns {string}
 */
export function css(...decls) {
  return decls.filter(Boolean).join(';') + (decls.some(Boolean) ? ';' : '');
}

/**
 * style="..." 属性（中身が空なら空文字）
 * @param {...(string | false | null | undefined)} decls
 * @returns {string}
 */
export function styleAttr(...decls) {
  const value = css(...decls);
  return value ? ` style="${escapeAttr(value)}"` : '';
}

/**
 * @param {Spacing} spacing
 * @returns {string} 例: 'padding:10px' / 'padding:0 8px 0 8px'
 */
export function paddingDecl(spacing) {
  const { top, right, bottom, left } = spacing;
  const px = (/** @type {number} */ n) => (n === 0 ? '0' : `${n}px`);
  if (top === right && right === bottom && bottom === left) return `padding:${px(top)}`;
  if (top === bottom && left === right) return `padding:${px(top)} ${px(right)}`;
  return `padding:${px(top)} ${px(right)} ${px(bottom)} ${px(left)}`;
}

/**
 * @typedef {Object} TextStyle
 * @property {string} fontFamily
 * @property {number} fontSize px
 * @property {number} lineHeight 倍率
 * @property {string} color
 */

/**
 * ブロックの文字設定をボディ設定で補う
 * @param {BodySettings} body
 * @param {{ fontFamily?: unknown, fontSize?: unknown, lineHeight?: unknown, color?: unknown }} [values]
 * @returns {TextStyle}
 */
export function resolveTextStyle(body, values = {}) {
  return {
    fontFamily: typeof values.fontFamily === 'string' ? values.fontFamily : body.fontFamily,
    fontSize: typeof values.fontSize === 'number' ? values.fontSize : body.fontSize,
    lineHeight: typeof values.lineHeight === 'number' ? values.lineHeight : body.lineHeight,
    color: typeof values.color === 'string' ? values.color : body.textColor,
  };
}

/**
 * 文字の宣言一式。行の高さは Outlook のために px で出す
 * @param {TextStyle} style
 * @param {number} [fontSize] 見出しなどで文字サイズだけ変えるとき
 * @returns {string[]}
 */
export function fontDecls(style, fontSize = style.fontSize) {
  return [
    `font-family:${style.fontFamily}`,
    `font-size:${fontSize}px`,
    `line-height:${Math.round(fontSize * style.lineHeight)}px`,
    `color:${style.color}`,
  ];
}

/** role="presentation" の入れ子用テーブル（開始タグ） */
export const TABLE_OPEN =
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"';
