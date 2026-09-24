import { s } from '../model/schema.js';
import { styleAttr } from '../render-html/styles.js';

/** @type {import('./types.js').CoreBlockDef} */
export const dividerBlock = {
  type: 'divider',
  defaults: () => ({
    thickness: 1,
    color: '#dddddd',
    lineStyle: 'solid',
    widthPercent: 100,
    align: 'center',
  }),
  schema: s.object({
    thickness: s.number({ min: 1, max: 20, integer: true }),
    color: s.color(),
    lineStyle: s.oneOf(['solid', 'dashed', 'dotted']),
    widthPercent: s.number({ min: 1, max: 100, integer: true }),
    align: s.oneOf(['left', 'center', 'right']),
  }),
  mergeTagFields: [],
  cellAlign: (block) => /** @type {any} */ (block.values.align),

  renderHtml(block) {
    const v = /** @type {any} */ (block.values);
    const margin =
      v.align === 'center' ? 'margin:0 auto' : v.align === 'right' ? 'margin:0 0 0 auto' : null;
    const alignAttr = v.align === 'center' ? ' align="center"' : '';
    return [
      `<table role="presentation" width="${v.widthPercent}%" cellpadding="0" cellspacing="0" border="0"${alignAttr}${styleAttr(`width:${v.widthPercent}%`, margin)}>`,
      [
        `<tr><td${styleAttr(`border-top:${v.thickness}px ${v.lineStyle} ${v.color}`, 'font-size:0', 'line-height:0', 'mso-line-height-rule:exactly')}>&nbsp;</td></tr>`,
      ],
      '</table>',
    ];
  },

  renderText(_block, ctx) {
    return ctx.options.dividerText;
  },
};
