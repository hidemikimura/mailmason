import { s } from '../model/schema.js';
import { sanitizeHtml } from '../richtext/sanitize.js';
import { richTextToPlain } from '../richtext/to-text.js';
import { renderRichText } from '../render-html/richtext.js';
import { fontDecls, resolveTextStyle, styleAttr } from '../render-html/styles.js';
import { wrap } from '../render-html/lines.js';
import { classAttr, resolveMobileFontSize } from '../render-html/mobile.js';

/** @type {import('./types.js').CoreBlockDef} */
export const textBlock = {
  type: 'text',
  defaults: () => ({
    html: '',
    fontFamily: null,
    fontSize: null,
    mobileFontSize: null,
    lineHeight: null,
    color: null,
  }),
  schema: s.object({
    html: s.string(),
    fontFamily: s.string({ nullable: true }),
    fontSize: s.number({ min: 8, max: 72, nullable: true }),
    mobileFontSize: s.number({ min: 8, max: 72, nullable: true }),
    lineHeight: s.number({ min: 0.8, max: 3, nullable: true }),
    color: s.color({ nullable: true }),
  }),
  mergeTagFields: ['html'],
  sanitize: (values, options) => ({ ...values, html: sanitizeHtml(values.html, options) }),

  renderHtml(block, ctx) {
    const { values } = block;
    if (typeof values.html !== 'string' || values.html === '') return [];
    const style = resolveTextStyle(ctx.body, values);
    const size = resolveMobileFontSize(
      ctx.body,
      /** @type {number | null} */ (values.fontSize),
      /** @type {number | null} */ (values.mobileFontSize),
    );
    const styles = ctx.options.mobileStyles;
    const mobile = size === null ? null : { fontSize: size, styles };
    const blocks = renderRichText(values.html, { style, linkColor: ctx.body.linkColor, mobile });
    const cls = size === null ? '' : classAttr(styles.font(size, style.lineHeight));
    return [wrap(`<div${cls}${styleAttr(...fontDecls(style))}>`, blocks, '</div>')];
  },

  renderText(block, ctx) {
    return richTextToPlain(String(block.values.html ?? ''), {
      headingPrefix: ctx.options.headingPrefix,
    });
  },
};
