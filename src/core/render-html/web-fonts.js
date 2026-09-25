// Web フォント: テンプレートで名前を使っているものだけ、head で CSS を読み込む。
// Apple Mail・iOS メール・Outlook for Mac などで表示される。Gmail・Outlook（Windows）などは読み込まず、
// font-family の後ろに書いたフォントで表示する（Outlook（Windows）は outlookFontFamily）
import { escapeAttr } from '../richtext/entities.js';
import { cssUrl } from './background.js';
import { WEB_FONT_URL } from '../model/settings.js';

/** @import { Template, WebFont } from '../model/types.js' */
/** @import { Lines } from './lines.js' */

/**
 * font-family の値に含まれるフォント名（引用符を外し、小文字にする）
 * @param {string} value
 * @returns {string[]}
 */
export function fontFamilyNames(value) {
  return value
    .split(',')
    .map((name) =>
      name
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
}

/**
 * テンプレートで使っているフォント名（ボディと、ブロックの values.fontFamily）
 * @param {Template} template
 * @returns {Set<string>}
 */
export function usedFontNames(template) {
  const names = new Set(fontFamilyNames(template.body.settings.fontFamily));
  for (const row of template.body.rows) {
    for (const column of row.columns) {
      for (const block of column.blocks) {
        const family = block.values.fontFamily;
        if (typeof family === 'string') fontFamilyNames(family).forEach((n) => names.add(n));
      }
    }
  }
  return names;
}

/**
 * 出力する Web フォント（名前を使っていて、URL が正しいもの。同じ URL は 1 回）
 * @param {Template} template
 * @returns {WebFont[]}
 */
export function usedWebFonts(template) {
  const names = usedFontNames(template);
  const urls = new Set();
  return template.body.settings.webFonts.filter((font) => {
    if (!WEB_FONT_URL.test(font.url) || urls.has(font.url)) return false;
    if (!names.has(font.family.trim().toLowerCase())) return false;
    urls.add(font.url);
    return true;
  });
}

/**
 * head に入れる読み込み（link 要素と CSS の import の両方。Outlook（Windows）には出さない）
 * @param {WebFont[]} fonts
 * @returns {Lines}
 */
export function webFontHead(fonts) {
  if (fonts.length === 0) return [];
  return [
    '<!--[if !mso]><!-->',
    ...fonts.map(
      (font) => `<link href="${escapeAttr(font.url)}" rel="stylesheet" type="text/css" />`,
    ),
    `<style type="text/css">${fonts.map((font) => `@import url('${cssUrl(font.url)}');`).join('')}</style>`,
    '<!--<![endif]-->',
  ];
}
