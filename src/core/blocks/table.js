// 表。セルは段落を持たないリッチテキスト（太字・リンク・文字色・改行・差し込み変数）。
// 1 行目を見出しにでき、列ごとに幅と揃えを持つ。
// データの表なので role="presentation" は付けない（読み上げで表として扱わせる。目印は class="mm-table"）
import { s } from '../model/schema.js';
import { sanitizeInlineHtml } from '../richtext/sanitize.js';
import { inlineRichTextToPlain } from '../richtext/to-text.js';
import { renderInlineRichText } from '../render-html/richtext.js';
import { fontDecls, resolveTextStyle, styleAttr } from '../render-html/styles.js';
import { wrap } from '../render-html/lines.js';
import { stringWidth } from '../text/width.js';

/** @import { Block } from '../model/types.js' */

/**
 * @typedef {Object} TableColumn
 * @property {number | null} width 幅（表の幅に対する %）。null なら残りを等分
 * @property {'left' | 'center' | 'right'} align
 */

/**
 * @typedef {Object} TableValues
 * @property {string[][]} cells 行ごとのセル（段落を持たないリッチテキスト）
 * @property {TableColumn[]} columns 列の設定（cells の各行と同じ数）
 * @property {boolean} headerRow 1 行目を見出しにする
 * @property {string} headerBackgroundColor
 * @property {string | null} headerColor 見出しの文字色（null なら本文の色）
 * @property {string} borderColor
 * @property {number} borderWidth 罫線の太さ（px、0 で罫線なし）
 * @property {number} cellPadding セルの内側の余白（px）
 * @property {boolean} striped 1 行おきに背景色を付ける
 * @property {string} stripeColor
 * @property {number | null} fontSize
 * @property {string | null} color
 */

/** 列の数・行の数の上限 */
export const TABLE_MAX_COLUMNS = 8;
export const TABLE_MAX_ROWS = 50;

/** @returns {TableColumn} */
export const defaultTableColumn = () => ({ width: null, align: 'left' });

const columnSchema = s.object({
  width: s.number({ min: 1, max: 100, integer: true, nullable: true }),
  align: s.oneOf(['left', 'center', 'right']),
});

/**
 * セルの配列を columns の数にそろえる（足りなければ空のセル、多ければ切る）
 * @param {unknown[][]} cells
 * @param {number} count
 * @returns {string[][]}
 */
function rectangular(cells, count) {
  return cells.map((row) =>
    Array.from({ length: count }, (_, i) => (typeof row[i] === 'string' ? row[i] : '')),
  );
}

/**
 * 列の幅（px）を決める。% の指定を優先し、残りを未指定の列で等分する
 * @param {TableColumn[]} columns
 * @param {number} width 表の幅（px）
 * @returns {number[]}
 */
export function tableColumnWidths(columns, width) {
  const fixed = columns.reduce((sum, c) => sum + (c.width ?? 0), 0);
  const free = columns.filter((c) => c.width === null).length;
  const rest = Math.max(0, 100 - fixed);
  const scale = fixed > 100 ? 100 / fixed : 1; // 合計が 100% を超えたら縮める
  const percents = columns.map((c) =>
    c.width === null ? (free > 0 ? rest / free : 0) : c.width * scale,
  );
  const px = percents.map((p) => Math.floor((width * p) / 100));
  // 端数は最後の列に足して合計を表の幅にそろえる
  const sum = px.reduce((a, b) => a + b, 0);
  if (px.length > 0) px[px.length - 1] += width - sum;
  return px;
}

/** @type {import('./types.js').CoreBlockDef} */
export const tableBlock = {
  type: 'table',
  defaults: () => ({
    cells: [
      ['', ''],
      ['', ''],
      ['', ''],
    ],
    columns: [defaultTableColumn(), defaultTableColumn()],
    headerRow: true,
    headerBackgroundColor: '#f3f4f6',
    headerColor: null,
    borderColor: '#d0d7de',
    borderWidth: 1,
    cellPadding: 8,
    striped: false,
    stripeColor: '#f9fafb',
    fontSize: null,
    color: null,
  }),
  schema: s.object({
    cells: s.arrayOf(
      s.arrayOf(s.string(), () => ''),
      () => [],
    ),
    columns: s.arrayOf(columnSchema, defaultTableColumn),
    headerRow: s.boolean(),
    headerBackgroundColor: s.color(),
    headerColor: s.color({ nullable: true }),
    borderColor: s.color(),
    borderWidth: s.number({ min: 0, max: 8, integer: true }),
    cellPadding: s.number({ min: 0, max: 40, integer: true }),
    striped: s.boolean(),
    stripeColor: s.color(),
    fontSize: s.number({ min: 8, max: 72, nullable: true }),
    color: s.color({ nullable: true }),
  }),
  mergeTagFields: ['cells'],
  // 読み込み時: セルを整え、行と列の数をそろえる
  sanitize(values, options) {
    const v = /** @type {TableValues} */ (values);
    const count = Math.min(
      TABLE_MAX_COLUMNS,
      Math.max(1, v.columns.length, ...v.cells.map((row) => row.length)),
    );
    const columns = Array.from({ length: count }, (_, i) => v.columns[i] ?? defaultTableColumn());
    const cells = rectangular(v.cells.slice(0, TABLE_MAX_ROWS), count).map((row) =>
      row.map((cell) => sanitizeInlineHtml(cell, options)),
    );
    return { ...v, columns, cells: cells.length > 0 ? cells : [Array(count).fill('')] };
  },

  renderHtml(block, ctx) {
    const v = /** @type {TableValues} */ (/** @type {unknown} */ (block.values));
    const count = v.columns.length;
    const cells = rectangular(v.cells, count);
    if (count === 0 || cells.every((row) => row.every((cell) => cell === ''))) return [];
    const style = resolveTextStyle(ctx.body, {
      fontFamily: null,
      fontSize: v.fontSize,
      lineHeight: Math.min(ctx.body.lineHeight, 1.5),
      color: v.color,
    });
    const widths = tableColumnWidths(v.columns, ctx.width);
    const border = v.borderWidth > 0 ? `${v.borderWidth}px solid ${v.borderColor}` : null;
    const rows = cells.map((row, r) => {
      const header = v.headerRow && r === 0;
      const stripe = v.striped && !header && (r - (v.headerRow ? 1 : 0)) % 2 === 1;
      const background = header ? v.headerBackgroundColor : stripe ? v.stripeColor : null;
      const color = header && v.headerColor ? v.headerColor : style.color;
      const tag = header ? 'th' : 'td';
      const tds = row.map((cell, c) => {
        const { align } = v.columns[c];
        const content = renderInlineRichText(cell, { linkColor: ctx.body.linkColor });
        return (
          `<${tag}${header ? ' scope="col"' : ''} width="${widths[c]}" align="${align}" valign="top"` +
          styleAttr(
            `width:${widths[c]}px`,
            `padding:${v.cellPadding}px`,
            border && `border:${border}`,
            background && `background-color:${background}`,
            ...fontDecls({ ...style, color }),
            header ? 'font-weight:bold' : null,
            `text-align:${align}`,
          ) +
          `>${content || '&nbsp;'}</${tag}>`
        );
      });
      return wrap('<tr>', tds, '</tr>');
    });
    return [
      wrap(
        `<table class="mm-table" width="${ctx.width}" cellpadding="0" cellspacing="0" border="0"${styleAttr('width:100%', `max-width:${ctx.width}px`, 'border-collapse:collapse', 'mso-table-lspace:0pt', 'mso-table-rspace:0pt')}>`,
        rows,
        '</table>',
      ),
    ];
  },

  renderText(block) {
    const v = /** @type {TableValues} */ (/** @type {unknown} */ (block.values));
    const rows = rectangular(v.cells, v.columns.length)
      .map((row) => row.map((cell) => inlineRichTextToPlain(cell).replace(/\n/g, ' ')))
      .filter((row) => row.some((cell) => cell !== ''));
    if (rows.length === 0) return '';
    const lines = rows.map((row) => row.join(' | ').trimEnd());
    if (v.headerRow && rows.length > 1 && v.cells[0].some((cell) => cell !== '')) {
      const width = Math.min(40, Math.max(...lines.map((line) => stringWidth(line))));
      lines.splice(1, 0, '-'.repeat(width));
    }
    return lines.join('\n');
  },
};

/**
 * 表の行・列の操作（エディタのツールバーから使う）。値を変えずに新しい values の一部を返す
 * @param {Block} block
 */
export function tableOps(block) {
  const v = /** @type {TableValues} */ (/** @type {unknown} */ (block.values));
  const count = v.columns.length;
  const cells = rectangular(v.cells, count);
  return {
    /** @param {number} index 新しい行の位置 */
    insertRow(index) {
      if (cells.length >= TABLE_MAX_ROWS) return null;
      const next = cells.slice();
      next.splice(index, 0, Array(count).fill(''));
      return { cells: next };
    },
    /** @param {number} index */
    removeRow(index) {
      if (cells.length <= 1) return null;
      return { cells: cells.filter((_, i) => i !== index) };
    },
    /** @param {number} index 新しい列の位置 */
    insertColumn(index) {
      if (count >= TABLE_MAX_COLUMNS) return null;
      const columns = v.columns.slice();
      columns.splice(index, 0, defaultTableColumn());
      return {
        columns,
        cells: cells.map((row) => {
          const next = row.slice();
          next.splice(index, 0, '');
          return next;
        }),
      };
    },
    /** @param {number} index */
    removeColumn(index) {
      if (count <= 1) return null;
      return {
        columns: v.columns.filter((_, i) => i !== index),
        cells: cells.map((row) => row.filter((_, i) => i !== index)),
      };
    },
  };
}
