/** @import { RowLayout } from './types.js' */

/**
 * 行レイアウト → 12 分割グリッドでの各カラムの幅
 * @type {Readonly<Record<RowLayout, readonly number[]>>}
 */
export const ROW_LAYOUTS = Object.freeze({
  1: Object.freeze([12]),
  '1:1': Object.freeze([6, 6]),
  '1:1:1': Object.freeze([4, 4, 4]),
  '1:2': Object.freeze([4, 8]),
  '2:1': Object.freeze([8, 4]),
  '1:1:1:1': Object.freeze([3, 3, 3, 3]),
});

/** @type {RowLayout[]} */
export const ROW_LAYOUT_NAMES = /** @type {RowLayout[]} */ (Object.keys(ROW_LAYOUTS));

/**
 * @param {unknown} value
 * @returns {value is RowLayout}
 */
export function isRowLayout(value) {
  return typeof value === 'string' && Object.hasOwn(ROW_LAYOUTS, value);
}

/**
 * @param {RowLayout} layout
 * @returns {readonly number[]}
 */
export function getLayoutSpans(layout) {
  return ROW_LAYOUTS[layout];
}

/**
 * カラム数から均等分割のレイアウトを求める（1〜4 以外は null）
 * @param {number} count
 * @returns {RowLayout | null}
 */
export function layoutForColumnCount(count) {
  /** @type {Record<number, RowLayout>} */
  const map = { 1: '1', 2: '1:1', 3: '1:1:1', 4: '1:1:1:1' };
  return map[count] ?? null;
}

/**
 * @typedef {Object} ColumnBox
 * @property {string} columnId
 * @property {number} outerWidth カラムのセル全体の幅（隙間を含む）
 * @property {number} gapLeft 左側に割り当てた隙間
 * @property {number} gapRight 右側に割り当てた隙間
 * @property {number} contentWidth ブロックを置ける幅（隙間とカラム余白を除く）
 */

/**
 * @typedef {Object} RowBox
 * @property {string} rowId
 * @property {number} contentWidth 行の余白を除いた幅
 * @property {ColumnBox[]} columns
 */

/**
 * 各行・各カラムの幅（px、整数）を求める。
 * 隙間を除いた幅を 12 分割比で配分し（端数は最後のカラム）、
 * カラム間の隙間は左右のカラムに半分ずつ割り当てる（外側の端には付けない）。
 * @param {import('./types.js').Template} template
 * @returns {Map<string, RowBox>} 行 ID → 行の寸法
 */
export function computeLayout(template) {
  const { width } = template.body.settings;
  /** @type {Map<string, RowBox>} */
  const result = new Map();
  for (const row of template.body.rows) {
    const { padding, columnGap } = row.settings;
    const contentWidth = Math.max(1, width - padding.left - padding.right);
    const spans = getLayoutSpans(row.layout);
    const count = spans.length;
    const gap = count > 1 ? columnGap : 0;
    const available = Math.max(count, contentWidth - gap * (count - 1));
    const inner = spans.map((span) => Math.floor((available * span) / 12));
    inner[count - 1] += available - inner.reduce((sum, w) => sum + w, 0);
    const half = Math.floor(gap / 2);
    const columns = row.columns.map((column, i) => {
      const gapLeft = i === 0 ? 0 : gap - half;
      const gapRight = i === count - 1 ? 0 : half;
      const { left, right } = column.settings.padding;
      return {
        columnId: column.id,
        outerWidth: inner[i] + gapLeft + gapRight,
        gapLeft,
        gapRight,
        contentWidth: Math.max(1, inner[i] - left - right),
      };
    });
    result.set(row.id, { rowId: row.id, contentWidth, columns });
  }
  return result;
}
