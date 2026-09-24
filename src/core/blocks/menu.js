// メニュー: 横並びのテキストリンク（ヘッダーのナビゲーションなど）。狭い画面では自然に折り返す
import { s } from '../model/schema.js';
import { escapeAttr, escapeText } from '../richtext/entities.js';
import { fontDecls, resolveTextStyle, styleAttr } from '../render-html/styles.js';

/**
 * @typedef {{ label: string, href: string }} MenuItem
 */

/** @returns {MenuItem} */
export const defaultMenuItem = () => ({ label: '', href: '' });

/** @type {import('./types.js').CoreBlockDef} */
export const menuBlock = {
  type: 'menu',
  defaults: () => ({
    items: [],
    separator: '|',
    spacing: 12,
    fontSize: 14,
    fontWeight: 'normal',
    color: null,
    separatorColor: '#c5cad1',
    underline: false,
    align: 'center',
  }),
  schema: s.object({
    items: s.arrayOf(s.object({ label: s.string(), href: s.string() }), defaultMenuItem),
    separator: s.string(),
    spacing: s.number({ min: 0, max: 60, integer: true }),
    fontSize: s.number({ min: 8, max: 72 }),
    fontWeight: s.oneOf(['normal', 'bold']),
    color: s.color({ nullable: true }),
    separatorColor: s.color(),
    underline: s.boolean(),
    align: s.oneOf(['left', 'center', 'right']),
  }),
  mergeTagFields: ['items[].label', 'items[].href'],
  cellAlign: (block) => /** @type {any} */ (block.values.align),

  renderHtml(block, ctx) {
    const v = /** @type {any} */ (block.values);
    const items = /** @type {MenuItem[]} */ (v.items).filter((item) => item.label);
    if (items.length === 0) return [];
    const style = resolveTextStyle(ctx.body, { fontSize: v.fontSize, color: v.color });
    const half = Math.round(v.spacing / 2);
    const link = (/** @type {MenuItem} */ item) => {
      const decls = [
        `color:${style.color}`,
        `font-weight:${v.fontWeight}`,
        `text-decoration:${v.underline ? 'underline' : 'none'}`,
        'white-space:nowrap',
      ];
      return item.href
        ? `<a href="${escapeAttr(item.href)}" target="_blank"${styleAttr(...decls)}>${escapeText(item.label)}</a>`
        : `<span${styleAttr(...decls)}>${escapeText(item.label)}</span>`;
    };
    // Outlook（Windows）はインラインの padding を無視するので、条件付きコメントで空白を足す
    const msoSpace = half > 0 ? '<!--[if mso]>&nbsp;<![endif]-->' : '';
    const separator = v.separator
      ? `${msoSpace}<span${styleAttr(`padding:0 ${half}px`, `color:${v.separatorColor}`)}>${escapeText(v.separator)}</span>${msoSpace}`
      : `<span${styleAttr(`padding:0 ${half}px`)}>&nbsp;</span>`;
    return [
      `<p${styleAttr('margin:0', ...fontDecls(style), `text-align:${v.align}`)}>${items.map(link).join(separator)}</p>`,
    ];
  },

  renderText(block) {
    const items = /** @type {MenuItem[]} */ (/** @type {any} */ (block.values).items).filter(
      (item) => item.label,
    );
    return items.map((item) => (item.href ? `${item.label}: ${item.href}` : item.label)).join('\n');
  },
};
