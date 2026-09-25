// ボタンの並び: 複数のボタンを横に並べる（スマホでは縦に並べられる）。見た目は共通、色はボタンごと
import { s } from '../model/schema.js';
import { styleAttr, TABLE_OPEN } from '../render-html/styles.js';
import { wrap } from '../render-html/lines.js';
import { buttonBlock } from './button.js';

/**
 * @typedef {{ label: string, href: string, backgroundColor: string, color: string }} ButtonItem
 */

/** @returns {ButtonItem} */
export const defaultButtonItem = () => ({
  label: '',
  href: '',
  backgroundColor: '#0066cc',
  color: '#ffffff',
});

/** @type {import('./types.js').CoreBlockDef} */
export const buttonsBlock = {
  type: 'buttons',
  defaults: () => ({
    items: [],
    fontSize: 16,
    mobileFontSize: null,
    fontWeight: 'bold',
    borderRadius: 4,
    innerPadding: { top: 12, right: 24, bottom: 12, left: 24 },
    gap: 12,
    equalWidth: false,
    stackOnMobile: true,
    align: 'center',
  }),
  schema: s.object({
    items: s.arrayOf(
      s.object({
        label: s.string(),
        href: s.string(),
        backgroundColor: s.color(),
        color: s.color(),
      }),
      defaultButtonItem,
    ),
    fontSize: s.number({ min: 8, max: 72 }),
    mobileFontSize: s.number({ min: 8, max: 72, nullable: true }),
    fontWeight: s.oneOf(['normal', 'bold']),
    borderRadius: s.number({ min: 0, max: 100, integer: true }),
    innerPadding: s.spacing(),
    gap: s.number({ min: 0, max: 60, integer: true }),
    equalWidth: s.boolean(),
    stackOnMobile: s.boolean(),
    align: s.oneOf(['left', 'center', 'right']),
  }),
  mergeTagFields: ['items[].label', 'items[].href'],
  cellAlign: (block) => /** @type {any} */ (block.values.align),

  renderHtml(block, ctx) {
    const v = /** @type {any} */ (block.values);
    const items = /** @type {ButtonItem[]} */ (v.items).filter((item) => item.label);
    if (items.length === 0) return [];
    const n = items.length;
    // 各ボタンのセル幅。等幅ならブロック幅を等分し、そうでなければ文字数に合わせる（はみ出すときは等分）
    const slot = Math.max(1, Math.floor((ctx.width - v.gap * (n - 1)) / n));
    const cells = items.map((item, i) => {
      const values = {
        ...buttonBlock.defaults(),
        label: item.label,
        href: item.href,
        backgroundColor: item.backgroundColor,
        color: item.color,
        fontSize: v.fontSize,
        mobileFontSize: v.mobileFontSize,
        fontWeight: v.fontWeight,
        borderRadius: v.borderRadius,
        innerPadding: v.innerPadding,
        width: v.equalWidth ? 'full' : 'auto',
      };
      const button = buttonBlock.renderHtml(
        { ...block, type: 'button', values },
        { ...ctx, width: slot },
      );
      const classes = v.stackOnMobile ? ` class="mm-col${i > 0 ? ' mm-stack-gap' : ''}"` : '';
      const pad = i > 0 ? `padding-left:${v.gap}px` : null;
      return wrap(
        `<td${classes} align="center" valign="middle"${v.equalWidth ? ` width="${slot + (i > 0 ? v.gap : 0)}"` : ''}${styleAttr(pad, v.equalWidth && `width:${slot + (i > 0 ? v.gap : 0)}px`)}>`,
        button,
        '</td>',
      );
    });
    const table = v.equalWidth ? `${TABLE_OPEN}>` : TABLE_OPEN.replace(' width="100%"', '') + '>';
    return [wrap(table, [wrap('<tr>', cells, '</tr>')], '</table>')];
  },

  renderText(block) {
    const items = /** @type {ButtonItem[]} */ (/** @type {any} */ (block.values).items).filter(
      (item) => item.label,
    );
    return items
      .map((item) => (item.href ? `▶ ${item.label}\n  ${item.href}` : `▶ ${item.label}`))
      .join('\n');
  },
};
