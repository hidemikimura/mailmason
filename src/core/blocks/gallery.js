// 画像ギャラリー: 複数の画像を格子状に並べる（1 ブロックで 2〜4 列）
import { s } from '../model/schema.js';
import { styleAttr, TABLE_OPEN } from '../render-html/styles.js';
import { wrap } from '../render-html/lines.js';
import { imageHtml, imageText } from './image.js';

/**
 * @typedef {Object} GalleryItem
 * @property {{ src: string, alt: string, naturalWidth: number | null, naturalHeight: number | null, uploadData: Record<string, unknown> | null }} image
 * @property {string} href
 */

const px = (/** @type {number} */ n) => (n === 0 ? '0' : `${n}px`);

/** @returns {GalleryItem} */
export const defaultGalleryItem = () => ({
  image: { src: '', alt: '', naturalWidth: null, naturalHeight: null, uploadData: null },
  href: '',
});

/** @type {import('./types.js').CoreBlockDef} */
export const galleryBlock = {
  type: 'gallery',
  defaults: () => ({ items: [], columns: '2', gap: 8, stackOnMobile: false }),
  schema: s.object({
    items: s.arrayOf(
      s.object({
        image: s.object({
          src: s.string(),
          alt: s.string(),
          naturalWidth: s.number({ min: 1, integer: true, nullable: true }),
          naturalHeight: s.number({ min: 1, integer: true, nullable: true }),
          uploadData: s.record({ nullable: true }),
        }),
        href: s.string(),
      }),
      defaultGalleryItem,
    ),
    columns: s.oneOf(['2', '3', '4']),
    gap: s.number({ min: 0, max: 40, integer: true }),
    stackOnMobile: s.boolean(),
  }),
  mergeTagFields: ['items[].image.src', 'items[].image.alt', 'items[].href'],

  renderHtml(block, ctx) {
    const v = /** @type {any} */ (block.values);
    const items = /** @type {GalleryItem[]} */ (v.items).filter((item) => item.image.src);
    if (items.length === 0) return [];
    const per = Number(v.columns);
    const half = v.gap / 2;
    const cellWidth = Math.floor(ctx.width / per);
    const imageWidth = Math.max(1, Math.round(cellWidth - v.gap + v.gap / per));
    /** @type {import('../render-html/lines.js').Lines} */
    const rows = [];
    const lastRow = Math.floor((items.length - 1) / per) * per;
    for (let i = 0; i < items.length; i += per) {
      const chunk = items.slice(i, i + per);
      const isLastRow = i === lastRow;
      const cells = Array.from({ length: per }, (_, c) => {
        const item = chunk[c];
        const first = c === 0;
        const last = c === per - 1;
        // 行の間の余白は最後の行以外の下に付ける。スマホで縦に並べるときは、
        // 最後の行の 2 つ目以降に上の余白を付け、空きのセルは隠す
        const bottom = isLastRow ? 0 : v.gap;
        const padding = `padding:${[0, last ? 0 : half, bottom, first ? 0 : half].map(px).join(' ')}`;
        const classes = !v.stackOnMobile
          ? []
          : !item
            ? ['mm-col', 'mm-hide-mobile']
            : isLastRow && !first
              ? ['mm-col', 'mm-stack-gap']
              : ['mm-col'];
        const cls = classes.length > 0 ? ` class="${classes.join(' ')}"` : '';
        return wrap(
          `<td${cls} width="${cellWidth}" valign="top"${styleAttr(`width:${cellWidth}px`, padding)}>`,
          item
            ? [
                imageHtml({
                  ...item.image,
                  href: item.href,
                  width: imageWidth,
                  // 縦に並べたときは画面幅いっぱいに広げる
                  className: v.stackOnMobile ? 'mm-fluid' : undefined,
                }),
              ]
            : [],
          '</td>',
        );
      });
      rows.push(wrap('<tr>', cells, '</tr>'));
    }
    return [wrap(`${TABLE_OPEN}>`, rows, '</table>')];
  },

  renderText(block) {
    const items = /** @type {GalleryItem[]} */ (/** @type {any} */ (block.values).items);
    return items
      .map((item) => imageText({ src: item.image.src, alt: item.image.alt, href: item.href }))
      .filter(Boolean)
      .join('\n');
  },
};
