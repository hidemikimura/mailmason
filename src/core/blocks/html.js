import { s } from '../model/schema.js';
import { sanitizeHtml } from '../richtext/sanitize.js';
import { richTextToPlain } from '../richtext/to-text.js';

/** @type {import('./types.js').CoreBlockDef} */
export const htmlBlock = {
  type: 'html',
  defaults: () => ({ html: '' }),
  schema: s.object({ html: s.string() }),
  mergeTagFields: ['html'],

  renderHtml(block) {
    const html = String(block.values.html ?? '');
    return html.trim() === '' ? [] : [html];
  },

  // 生 HTML は許可タグに整えてからテキスト化する（精度は保証しない）
  renderText(block, ctx) {
    const html = sanitizeHtml(String(block.values.html ?? ''), {
      delimiters: ctx.options.mergeTagDelimiters,
    });
    return richTextToPlain(html, { headingPrefix: ctx.options.headingPrefix });
  },
};
