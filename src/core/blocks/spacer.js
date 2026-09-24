import { s } from '../model/schema.js';
import { spacing } from '../model/settings.js';
import { TABLE_OPEN, styleAttr } from '../render-html/styles.js';

/** @type {import('./types.js').CoreBlockDef} */
export const spacerBlock = {
  type: 'spacer',
  defaults: () => ({ height: 24 }),
  defaultStyle: () => ({ backgroundColor: null, padding: spacing(0) }),
  schema: s.object({
    height: s.number({ min: 1, max: 500, integer: true }),
  }),
  mergeTagFields: [],

  renderHtml(block) {
    const height = Number(block.values.height);
    return [
      `${TABLE_OPEN}>`,
      [
        `<tr><td height="${height}"${styleAttr(`height:${height}px`, 'font-size:0', `line-height:${height}px`, 'mso-line-height-rule:exactly')}>&nbsp;</td></tr>`,
      ],
      '</table>',
    ];
  },

  renderText() {
    return '';
  },
};
