import { s } from '../model/schema.js';
import { sanitizeHtml } from '../richtext/sanitize.js';
import { richTextToPlain } from '../richtext/to-text.js';
import { renderRichText } from '../render-html/richtext.js';
import { TABLE_OPEN, fontDecls, resolveTextStyle, styleAttr } from '../render-html/styles.js';
import { wrap } from '../render-html/lines.js';
import { imageHtml, imageText } from './image.js';

/** 画像とテキストの間隔（px） */
const GAP = 12;

/** @type {import('./types.js').CoreBlockDef} */
export const imageTextBlock = {
  type: 'imageText',
  defaults: () => ({
    image: {
      src: '',
      alt: '',
      href: '',
      naturalWidth: null,
      naturalHeight: null,
      uploadData: null,
    },
    imagePosition: 'left',
    imageWidthPercent: 40,
    html: '',
  }),
  schema: s.object({
    image: s.object({
      src: s.string(),
      alt: s.string(),
      href: s.string(),
      naturalWidth: s.number({ min: 1, integer: true, nullable: true }),
      naturalHeight: s.number({ min: 1, integer: true, nullable: true }),
      uploadData: s.record({ nullable: true }),
    }),
    imagePosition: s.oneOf(['left', 'right']),
    imageWidthPercent: s.number({ min: 10, max: 90, integer: true }),
    html: s.string(),
  }),
  mergeTagFields: ['image.src', 'image.alt', 'image.href', 'html'],
  sanitize: (values, options) => ({ ...values, html: sanitizeHtml(values.html, options) }),

  renderHtml(block, ctx) {
    const v = /** @type {any} */ (block.values);
    const style = resolveTextStyle(ctx.body);
    const text = v.html
      ? [
          wrap(
            `<div${styleAttr(...fontDecls(style))}>`,
            renderRichText(v.html, { style, linkColor: ctx.body.linkColor }),
            '</div>',
          ),
        ]
      : [];
    if (!v.image.src) return text;

    const imageWidth = Math.max(1, Math.round((ctx.width * v.imageWidthPercent) / 100));
    const textWidth = Math.max(1, ctx.width - imageWidth);
    const right = v.imagePosition === 'right';
    // 画像を右に置くときも、スマホで縦積みにしたとき画像が先に来るよう dir="rtl" を使う
    const dir = right ? ' dir="ltr"' : '';
    const gapSide = right ? 'padding-right' : 'padding-left';

    return [
      wrap(
        `${TABLE_OPEN}${right ? ' dir="rtl"' : ''}>`,
        [
          wrap(
            '<tr>',
            [
              wrap(
                `<td class="mm-col" width="${imageWidth}" valign="top"${dir}${styleAttr(`width:${imageWidth}px`)}>`,
                [imageHtml({ ...v.image, width: imageWidth })],
                '</td>',
              ),
              wrap(
                `<td class="mm-col mm-it-text" width="${textWidth}" valign="top"${dir}${styleAttr(`width:${textWidth}px`, `${gapSide}:${GAP}px`)}>`,
                text,
                '</td>',
              ),
            ],
            '</tr>',
          ),
        ],
        '</table>',
      ),
    ];
  },

  renderText(block, ctx) {
    const v = /** @type {any} */ (block.values);
    return [
      imageText(v.image),
      richTextToPlain(v.html, { headingPrefix: ctx.options.headingPrefix }),
    ]
      .filter(Boolean)
      .join('\n\n');
  },
};
