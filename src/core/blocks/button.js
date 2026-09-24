import { s } from '../model/schema.js';
import { escapeAttr, escapeText } from '../richtext/entities.js';
import { estimateTextWidth } from '../text/width.js';
import { paddingDecl, styleAttr } from '../render-html/styles.js';

/** @type {import('./types.js').CoreBlockDef} */
export const buttonBlock = {
  type: 'button',
  defaults: () => ({
    label: '',
    href: '',
    backgroundColor: '#0066cc',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    borderRadius: 4,
    innerPadding: { top: 12, right: 24, bottom: 12, left: 24 },
    width: 'auto',
    align: 'center',
  }),
  schema: s.object({
    label: s.string(),
    href: s.string(),
    backgroundColor: s.color(),
    color: s.color(),
    fontSize: s.number({ min: 8, max: 72 }),
    fontWeight: s.oneOf(['normal', 'bold']),
    borderRadius: s.number({ min: 0, max: 100, integer: true }),
    innerPadding: s.spacing(),
    width: s.oneOf(['auto', 'full']),
    align: s.oneOf(['left', 'center', 'right']),
  }),
  mergeTagFields: ['label', 'href'],
  cellAlign: (block) => /** @type {any} */ (block.values.align),

  renderHtml(block, ctx) {
    const v = /** @type {any} */ (block.values);
    if (!v.label) return [];
    const bold = v.fontWeight === 'bold';
    const lineHeight = Math.round(v.fontSize * 1.25);
    const pad = v.innerPadding;
    const height = lineHeight + pad.top + pad.bottom;
    const full = v.width === 'full';
    // VML は幅の指定が必須なので、auto のときは文字数から推定する
    const width = full
      ? ctx.width
      : Math.min(ctx.width, estimateTextWidth(v.label, v.fontSize, bold) + pad.left + pad.right);
    const arcsize = Math.min(50, Math.round((v.borderRadius / Math.min(width, height)) * 100));
    const href = v.href ? ` href="${escapeAttr(v.href)}"` : '';
    const label = escapeText(v.label);
    const weight = bold ? 'bold' : 'normal';

    return [
      '<!--[if mso]>',
      `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"${href}${styleAttr(`height:${height}px`, 'v-text-anchor:middle', `width:${width}px`)} arcsize="${arcsize}%" strokecolor="${v.backgroundColor}" fillcolor="${v.backgroundColor}">`,
      '<w:anchorlock/>',
      `<center${styleAttr(`color:${v.color}`, `font-family:${ctx.options.outlookFontFamily}`, `font-size:${v.fontSize}px`, `font-weight:${weight}`)}>${label}</center>`,
      '</v:roundrect>',
      '<![endif]-->',
      '<!--[if !mso]><!-->',
      `<a${href} target="_blank"${styleAttr(
        full ? 'display:block' : 'display:inline-block',
        `background-color:${v.backgroundColor}`,
        `color:${v.color}`,
        `font-family:${ctx.body.fontFamily}`,
        `font-size:${v.fontSize}px`,
        `font-weight:${weight}`,
        `line-height:${lineHeight}px`,
        'text-align:center',
        'text-decoration:none',
        paddingDecl(pad),
        v.borderRadius > 0 && `border-radius:${v.borderRadius}px`,
      )}>${label}</a>`,
      '<!--<![endif]-->',
    ];
  },

  renderText(block) {
    const { label, href } = /** @type {any} */ (block.values);
    if (!label) return '';
    return href ? `▶ ${label}\n  ${href}` : `▶ ${label}`;
  },
};
