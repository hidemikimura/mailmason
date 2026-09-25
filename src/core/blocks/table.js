// 表。セルは段落を持たないリッチテキスト（太字・リンク・文字色・改行・差し込み変数）。
// 1 行目を見出しにでき、列ごとに幅と揃えを持つ。セルは縦・横に結合できる（merges）。
// mobileLayout が 'stack' のときは、スマホで 1 行ずつ「見出し：値」の縦並びに切り替える
// （メディアクエリに対応しないメーラーでは表のまま）。
// データの表なので role="presentation" は付けない（読み上げで表として扱わせる。目印は class="mm-table"）
import { s } from '../model/schema.js';
import { sanitizeInlineHtml } from '../richtext/sanitize.js';
import { inlineRichTextToPlain } from '../richtext/to-text.js';
import { renderInlineRichText } from '../render-html/richtext.js';
import { TABLE_OPEN, fontDecls, resolveTextStyle, styleAttr } from '../render-html/styles.js';
import { wrap } from '../render-html/lines.js';
import { stringWidth } from '../text/width.js';
import { classAttr, mobileFontClass } from '../render-html/mobile.js';
import {
  cellRange,
  expandRange,
  isCovered,
  mergesAfterInsert,
  mergesAfterRemove,
  moveLines,
  normalizeMerges,
  rangesIntersect,
  shiftTarget,
} from './table-layout.js';

/** @import { Block } from '../model/types.js' */
/** @import { TableMerge, TableRange } from './table-layout.js' */
/** @import { Lines } from '../render-html/lines.js' */

/**
 * @typedef {Object} TableColumn
 * @property {number | null} width 幅（表の幅に対する %）。null なら残りを等分
 * @property {'left' | 'center' | 'right'} align
 */

/**
 * @typedef {Object} TableValues
 * @property {string[][]} cells 行ごとのセル（段落を持たないリッチテキスト）
 * @property {TableColumn[]} columns 列の設定（cells の各行と同じ数）
 * @property {TableMerge[]} merges 結合したセル（左上のセルの位置と行・列の数）
 * @property {boolean} headerRow 1 行目を見出しにする
 * @property {string} headerBackgroundColor
 * @property {string | null} headerColor 見出しの文字色（null なら本文の色）
 * @property {string} borderColor
 * @property {number} borderWidth 罫線の太さ（px、0 で罫線なし）
 * @property {number} cellPadding セルの内側の余白（px）
 * @property {boolean} striped 1 行おきに背景色を付ける
 * @property {string} stripeColor
 * @property {number | null} fontSize
 * @property {number | null} mobileFontSize スマホの文字サイズ（null なら、fontSize が null のときメール全体のスマホの文字サイズ、それ以外は PC と同じ）
 * @property {string | null} color
 * @property {'table' | 'stack'} mobileLayout スマホでの表示（表のまま / 1 行ずつ縦に並べる）
 */

/** 列の数・行の数の上限 */
export const TABLE_MAX_COLUMNS = 8;
export const TABLE_MAX_ROWS = 50;

/** 縦並びにしたときの、行と行の間隔（px） */
const STACK_GAP = 12;

/** @returns {TableColumn} */
export const defaultTableColumn = () => ({ width: null, align: 'left' });

const columnSchema = s.object({
  width: s.number({ min: 1, max: 100, integer: true, nullable: true }),
  align: s.oneOf(['left', 'center', 'right']),
});

const mergeSchema = s.object({
  row: s.number({ min: 0, max: TABLE_MAX_ROWS - 1, integer: true }),
  column: s.number({ min: 0, max: TABLE_MAX_COLUMNS - 1, integer: true }),
  rowSpan: s.number({ min: 1, max: TABLE_MAX_ROWS, integer: true }),
  colSpan: s.number({ min: 1, max: TABLE_MAX_COLUMNS, integer: true }),
});

/** @returns {TableMerge} */
const defaultMerge = () => ({ row: 0, column: 0, rowSpan: 1, colSpan: 1 });

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
 * 描画・操作に使う形（セルは長方形、結合は表の中に収めたもの）
 * @param {TableValues} v
 */
function tableState(v) {
  const count = v.columns.length;
  const cells = rectangular(v.cells, count);
  return { cells, count, merges: normalizeMerges(v.merges ?? [], cells.length, count) };
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

/**
 * 行の見た目（見出し・縞）
 * @param {TableValues} v
 * @param {number} r
 */
export function tableRowKind(v, r) {
  const header = v.headerRow && r === 0;
  const stripe = v.striped && !header && (r - (v.headerRow ? 1 : 0)) % 2 === 1;
  return { header, stripe };
}

/**
 * 縦並びの 1 行分の項目。横に結合したセルは見出しを「 / 」でつなぎ、
 * 縦に結合したセルは覆う行のそれぞれに同じ値を出す
 * @param {string[][]} cells
 * @param {TableMerge[]} merges
 * @param {number} r
 * @param {boolean} headerRow
 * @returns {Array<{ label: string, value: string }>}
 */
export function stackItems(cells, merges, r, headerRow) {
  const count = cells[0]?.length ?? 0;
  /** @type {Array<{ label: string, value: string }>} */
  const items = [];
  for (let c = 0; c < count; c += 1) {
    const range = cellRange(merges, r, c);
    if (range.column !== c) continue; // 横の結合の 2 列目以降
    if (headerRow && range.row === 0) continue; // 見出しから縦に続く結合
    /** @type {string[]} */
    const labels = [];
    if (headerRow) {
      for (let k = c; k < c + range.colSpan; k += 1) {
        const head = cellRange(merges, 0, k);
        const label = cells[head.row][head.column];
        if (!labels.includes(label)) labels.push(label);
      }
    }
    items.push({
      label: labels.filter((label) => label !== '').join(' / '),
      value: cells[range.row][range.column],
    });
  }
  return items;
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
    merges: [],
    headerRow: true,
    headerBackgroundColor: '#f3f4f6',
    headerColor: null,
    borderColor: '#d0d7de',
    borderWidth: 1,
    cellPadding: 8,
    striped: false,
    stripeColor: '#f9fafb',
    fontSize: null,
    mobileFontSize: null,
    color: null,
    mobileLayout: 'table',
  }),
  schema: s.object({
    cells: s.arrayOf(
      s.arrayOf(s.string(), () => ''),
      () => [],
    ),
    columns: s.arrayOf(columnSchema, defaultTableColumn),
    merges: s.arrayOf(mergeSchema, defaultMerge),
    headerRow: s.boolean(),
    headerBackgroundColor: s.color(),
    headerColor: s.color({ nullable: true }),
    borderColor: s.color(),
    borderWidth: s.number({ min: 0, max: 8, integer: true }),
    cellPadding: s.number({ min: 0, max: 40, integer: true }),
    striped: s.boolean(),
    stripeColor: s.color(),
    fontSize: s.number({ min: 8, max: 72, nullable: true }),
    mobileFontSize: s.number({ min: 8, max: 72, nullable: true }),
    color: s.color({ nullable: true }),
    mobileLayout: s.oneOf(['table', 'stack']),
  }),
  mergeTagFields: ['cells'],
  // 読み込み時: セルを整え、行と列の数をそろえ、結合を表の中に収める（重なりと 1 セルの結合は除く）
  sanitize(values, options) {
    const v = /** @type {TableValues} */ (values);
    const count = Math.min(
      TABLE_MAX_COLUMNS,
      Math.max(1, v.columns.length, ...v.cells.map((row) => row.length)),
    );
    const columns = Array.from({ length: count }, (_, i) => v.columns[i] ?? defaultTableColumn());
    const sanitized = rectangular(v.cells.slice(0, TABLE_MAX_ROWS), count).map((row) =>
      row.map((cell) => sanitizeInlineHtml(cell, options)),
    );
    const cells = sanitized.length > 0 ? sanitized : [Array(count).fill('')];
    const merges = normalizeMerges(v.merges ?? [], cells.length, count);
    return { ...v, columns, cells, merges };
  },

  renderHtml(block, ctx) {
    const v = /** @type {TableValues} */ (/** @type {unknown} */ (block.values));
    const { cells, count, merges } = tableState(v);
    if (count === 0 || cells.every((row) => row.every((cell) => cell === ''))) return [];
    const style = resolveTextStyle(ctx.body, {
      fontFamily: null,
      fontSize: v.fontSize,
      lineHeight: Math.min(ctx.body.lineHeight, 1.5),
      color: v.color,
    });
    const widths = tableColumnWidths(v.columns, ctx.width);
    const border = v.borderWidth > 0 ? `${v.borderWidth}px solid ${v.borderColor}` : null;
    const headerColor = v.headerColor ?? style.color;
    const mobileFont = mobileFontClass(ctx, v.fontSize, v.mobileFontSize, style.lineHeight);
    /** @param {string} cell */
    const rich = (cell) =>
      renderInlineRichText(cell, { linkColor: ctx.body.linkColor }) || '&nbsp;';

    const rows = cells.map((row, r) => {
      const { header, stripe } = tableRowKind(v, r);
      const background = header ? v.headerBackgroundColor : stripe ? v.stripeColor : null;
      const color = header ? headerColor : style.color;
      const tag = header ? 'th' : 'td';
      /** @type {string[]} */
      const tds = [];
      row.forEach((cell, c) => {
        if (isCovered(merges, r, c)) return;
        const { rowSpan, colSpan } = cellRange(merges, r, c);
        const { align } = v.columns[c];
        const width = widths.slice(c, c + colSpan).reduce((a, b) => a + b, 0);
        const scope = header ? ` scope="${colSpan > 1 ? 'colgroup' : 'col'}"` : '';
        const spans =
          (colSpan > 1 ? ` colspan="${colSpan}"` : '') +
          (rowSpan > 1 ? ` rowspan="${rowSpan}"` : '');
        tds.push(
          `<${tag}${scope}${spans}${classAttr(mobileFont)} width="${width}" align="${align}" valign="top"` +
            styleAttr(
              `width:${width}px`,
              `padding:${v.cellPadding}px`,
              border && `border:${border}`,
              background && `background-color:${background}`,
              ...fontDecls({ ...style, color }),
              header ? 'font-weight:bold' : null,
              `text-align:${align}`,
            ) +
            `>${rich(cell)}</${tag}>`,
        );
      });
      return wrap('<tr>', tds, '</tr>');
    });
    const stack = v.mobileLayout === 'stack';
    /** @type {Lines} */
    const out = [
      wrap(
        `<table${classAttr('mm-table', stack && 'mm-hide-mobile')} width="${ctx.width}" cellpadding="0" cellspacing="0" border="0"${styleAttr('width:100%', `max-width:${ctx.width}px`, 'border-collapse:collapse', 'mso-table-lspace:0pt', 'mso-table-rspace:0pt')}>`,
        rows,
        '</table>',
      ),
    ];
    if (!stack) return out;

    // スマホ用の縦並び。メディアクエリで表と入れ替える（Outlook には出さない）
    /** @type {Lines} */
    const cards = [];
    const first = v.headerRow ? 1 : 0;
    for (let r = first; r < cells.length; r += 1) {
      const items = stackItems(cells, merges, r, v.headerRow);
      if (items.every((item) => item.value === '')) continue;
      const { stripe } = tableRowKind(v, r);
      /** @param {boolean} label */
      // 文字の設定は表にまとめて付ける（Outlook には出さないので、セルごとに付けなくてよい）
      const cellStyle = (label) =>
        styleAttr(
          label && 'width:40%',
          `padding:${v.cellPadding}px`,
          border && `border:${border}`,
          label
            ? `background-color:${v.headerBackgroundColor}`
            : stripe && `background-color:${v.stripeColor}`,
          label && headerColor !== style.color && `color:${headerColor}`,
          label && 'font-weight:bold',
        );
      if (cards.length > 0) {
        cards.push(
          `<tr><td${v.headerRow ? ' colspan="2"' : ''}${styleAttr(`height:${STACK_GAP}px`, `line-height:${STACK_GAP}px`, 'font-size:0')}>&nbsp;</td></tr>`,
        );
      }
      for (const item of items) {
        cards.push(
          wrap(
            '<tr>',
            [
              v.headerRow
                ? `<td width="40%" valign="top"${cellStyle(true)}>${rich(item.label)}</td>`
                : '',
              `<td valign="top"${cellStyle(false)}>${rich(item.value)}</td>`,
            ],
            '</tr>',
          ),
        );
      }
    }
    if (cards.length === 0) return out;
    out.push(
      '<!--[if !mso]><!-->',
      wrap(
        `<div class="mm-show-mobile"${styleAttr('display:none', 'max-height:0', 'overflow:hidden', 'mso-hide:all')}>`,
        [
          wrap(
            `${TABLE_OPEN.replace('<table ', `<table${classAttr('mm-table-stack', mobileFont)} `)}${styleAttr('width:100%', 'border-collapse:collapse', ...fontDecls(style), 'text-align:left')}>`,
            cards,
            '</table>',
          ),
        ],
        '</div>',
      ),
      '<!--<![endif]-->',
    );
    return out;
  },

  renderText(block) {
    const v = /** @type {TableValues} */ (/** @type {unknown} */ (block.values));
    const { cells, merges } = tableState(v);
    // 横に結合したセルは 1 つにまとめ、縦に結合したセルは各行に同じ値を出す
    const rows = cells
      .map((row, r) =>
        row.flatMap((_, c) => {
          const range = cellRange(merges, r, c);
          if (range.column !== c) return [];
          return [inlineRichTextToPlain(cells[range.row][c]).replace(/\n/g, ' ')];
        }),
      )
      .filter((row) => row.some((cell) => cell !== ''));
    if (rows.length === 0) return '';
    const lines = rows.map((row) => row.join(' | ').trimEnd());
    if (v.headerRow && rows.length > 1 && cells[0].some((cell) => cell !== '')) {
      const width = Math.min(40, Math.max(...lines.map((line) => stringWidth(line))));
      lines.splice(1, 0, '-'.repeat(width));
    }
    return lines.join('\n');
  },
};

/**
 * 表の行・列の操作（エディタのツールバーとドラッグから使う）。
 * 値を変えずに新しい values の一部を返す（できない操作は null）。結合は行・列の増減と移動に合わせて直す
 * @param {Block} block
 */
export function tableOps(block) {
  const v = /** @type {TableValues} */ (/** @type {unknown} */ (block.values));
  const { cells, count, merges } = tableState(v);
  const rowCount = cells.length;

  /**
   * 行を 1 つ消す（結合の左上のセルを消すときは、値を次の行に移す）
   * @param {string[][]} rows
   * @param {TableMerge[]} ms
   * @param {number} index
   */
  const dropRow = (rows, ms, index) => {
    const next = rows.map((row) => row.slice());
    for (const m of ms) {
      if (m.row === index && m.rowSpan > 1) next[index + 1][m.column] = next[index][m.column];
    }
    next.splice(index, 1);
    return { cells: next, merges: mergesAfterRemove(ms, 'row', index) };
  };

  /**
   * @param {string[][]} rows
   * @param {TableMerge[]} ms
   * @param {number} index
   */
  const dropColumn = (rows, ms, index) => {
    const next = rows.map((row) => row.slice());
    for (const m of ms) {
      if (m.column === index && m.colSpan > 1) {
        next[m.row][index + 1] = next[m.row][index];
      }
    }
    return {
      cells: next.map((row) => row.filter((_, i) => i !== index)),
      merges: mergesAfterRemove(ms, 'column', index),
    };
  };

  return {
    /** 表の中に収めた結合 */
    merges,

    /** @param {number} index 新しい行の位置 */
    insertRow(index) {
      if (rowCount >= TABLE_MAX_ROWS) return null;
      const next = cells.slice();
      next.splice(index, 0, Array(count).fill(''));
      return { cells: next, merges: mergesAfterInsert(merges, 'row', index) };
    },
    /**
     * @param {number} index
     * @param {number} [amount] 消す行の数
     */
    removeRow(index, amount = 1) {
      if (rowCount - amount < 1 || index < 0 || index + amount > rowCount) return null;
      let state = { cells, merges };
      for (let i = 0; i < amount; i += 1) state = dropRow(state.cells, state.merges, index);
      return state;
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
        merges: mergesAfterInsert(merges, 'column', index),
      };
    },
    /**
     * @param {number} index
     * @param {number} [amount] 消す列の数
     */
    removeColumn(index, amount = 1) {
      if (count - amount < 1 || index < 0 || index + amount > count) return null;
      let state = { cells, merges };
      for (let i = 0; i < amount; i += 1) state = dropColumn(state.cells, state.merges, index);
      return {
        columns: v.columns.filter((_, i) => i < index || i >= index + amount),
        ...state,
      };
    },

    /**
     * 行の start から amount 個を、元の位置で数えた gap（0〜行の数）の前に移す。
     * 縦の結合が途中で切れる移動は null
     * @param {number} start
     * @param {number} amount
     * @param {number} gap
     */
    moveRows(start, amount, gap) {
      const moved = moveLines(merges, 'row', rowCount, start, amount, gap);
      if (!moved) return null;
      return { cells: moved.order.map((i) => cells[i]), merges: moved.merges };
    },
    /**
     * @param {number} start
     * @param {number} amount
     * @param {number} gap 元の位置で数えた、移動先の列の前（0〜列の数）
     */
    moveColumns(start, amount, gap) {
      const moved = moveLines(merges, 'column', count, start, amount, gap);
      if (!moved) return null;
      return {
        columns: moved.order.map((i) => v.columns[i]),
        cells: cells.map((row) => moved.order.map((i) => row[i])),
        merges: moved.merges,
      };
    },
    /**
     * ボタンで行を 1 つ上・下に移すときの移動（縦に結合した行はまとめて動かす）。動かせなければ null
     * @param {number} start
     * @param {number} end 最後の行（含む）
     * @param {-1 | 1} direction
     */
    shiftRows(start, end, direction) {
      return shiftTarget(merges, 'row', rowCount, start, end, direction);
    },
    /**
     * @param {number} start
     * @param {number} end 最後の列（含む）
     * @param {-1 | 1} direction
     */
    shiftColumns(start, end, direction) {
      return shiftTarget(merges, 'column', count, start, end, direction);
    },

    /**
     * 範囲のセルを結合する（範囲にかかる結合を含むまで広げる）。
     * 空でないセルの値は左上のセルに改行でつなげ、他のセルは空にする
     * @param {TableRange} range
     */
    merge(range) {
      const r = expandRange(merges, range);
      if (r.rowSpan * r.colSpan <= 1) return null;
      if (
        r.row < 0 ||
        r.column < 0 ||
        r.row + r.rowSpan > rowCount ||
        r.column + r.colSpan > count
      ) {
        return null;
      }
      if (
        merges.some(
          (m) =>
            m.row === r.row &&
            m.column === r.column &&
            m.rowSpan === r.rowSpan &&
            m.colSpan === r.colSpan,
        )
      ) {
        return null; // 結合済み
      }
      const next = cells.map((row) => row.slice());
      /** @type {string[]} */
      const parts = [];
      for (let y = r.row; y < r.row + r.rowSpan; y += 1) {
        for (let x = r.column; x < r.column + r.colSpan; x += 1) {
          if (!isCovered(merges, y, x) && next[y][x] !== '') parts.push(next[y][x]);
          next[y][x] = '';
        }
      }
      next[r.row][r.column] = parts.join('<br>');
      return {
        cells: next,
        merges: normalizeMerges(
          [...merges.filter((m) => !rangesIntersect(m, r)), r],
          rowCount,
          count,
        ),
      };
    },
    /**
     * 範囲にかかる結合を解除する（値は左上のセルに残す）
     * @param {TableRange} range
     */
    unmerge(range) {
      const rest = merges.filter((m) => !rangesIntersect(m, range));
      if (rest.length === merges.length) return null;
      return { merges: rest };
    },
  };
}
