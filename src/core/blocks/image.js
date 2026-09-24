import { s } from '../model/schema.js';
import { escapeAttr } from '../richtext/entities.js';
import { styleAttr } from '../render-html/styles.js';

/** @import { HtmlContext } from './types.js' */

export const imageWidthSchema = s.object({
  unit: s.oneOf(['%', 'px']),
  value: s.number({ min: 1, max: 1200 }),
});

/**
 * @typedef {Object} ImageParams
 * @property {string} src
 * @property {string} alt
 * @property {string} href
 * @property {number} width 表示幅（px）
 * @property {number | null} naturalWidth
 * @property {number | null} naturalHeight
 * @property {'left' | 'center' | 'right'} [align]
 */

/**
 * メール用の img（リンク付きなら a で包む）
 * @param {ImageParams} image
 * @returns {string}
 */
export function imageHtml(image) {
  const { src, alt, href, width, naturalWidth, naturalHeight, align = 'left' } = image;
  const height =
    naturalWidth && naturalHeight ? Math.round((width * naturalHeight) / naturalWidth) : null;
  const margin =
    align === 'center' ? 'margin:0 auto' : align === 'right' ? 'margin:0 0 0 auto' : null;
  const img =
    `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" width="${width}"` +
    (height ? ` height="${height}"` : '') +
    styleAttr(
      'display:block',
      'width:100%',
      `max-width:${width}px`,
      'height:auto',
      'border:0',
      'outline:none',
      'text-decoration:none',
      margin,
    ) +
    ' />';
  return href ? `<a href="${escapeAttr(href)}" target="_blank">${img}</a>` : img;
}

/**
 * 画像の代替テキストをテキストパート用にする
 * @param {{ src: string, alt: string, href: string }} image
 * @returns {string}
 */
export function imageText(image) {
  if (!image.src) return '';
  if (image.alt) return image.href ? `[${image.alt}] ( ${image.href} )` : `[${image.alt}]`;
  return image.href;
}

/**
 * @param {{ unit: string, value: number }} width
 * @param {HtmlContext} ctx
 */
function pixelWidth(width, ctx) {
  const px = width.unit === '%' ? Math.round((ctx.width * width.value) / 100) : width.value;
  return Math.max(1, Math.min(px, ctx.width));
}

/** @type {import('./types.js').CoreBlockDef} */
export const imageBlock = {
  type: 'image',
  defaults: () => ({
    src: '',
    alt: '',
    href: '',
    width: { unit: '%', value: 100 },
    align: 'center',
    naturalWidth: null,
    naturalHeight: null,
    uploadData: null,
  }),
  schema: s.object({
    src: s.string(),
    alt: s.string(),
    href: s.string(),
    width: imageWidthSchema,
    align: s.oneOf(['left', 'center', 'right']),
    naturalWidth: s.number({ min: 1, integer: true, nullable: true }),
    naturalHeight: s.number({ min: 1, integer: true, nullable: true }),
    uploadData: s.record({ nullable: true }),
  }),
  mergeTagFields: ['src', 'alt', 'href'],
  cellAlign: (block) => /** @type {any} */ (block.values.align),

  renderHtml(block, ctx) {
    const v = /** @type {any} */ (block.values);
    if (!v.src) return [];
    return [imageHtml({ ...v, width: pixelWidth(v.width, ctx) })];
  },

  renderText(block) {
    return imageText(/** @type {any} */ (block.values));
  },
};
