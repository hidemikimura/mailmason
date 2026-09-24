// テンプレートの木を ID で探す・イミュータブルに差し替えるためのヘルパー
/** @import { Column, Row, Template } from './types.js' */

/**
 * @param {Template} template
 * @param {string} rowId
 * @returns {number} 見つからなければ -1
 */
export function findRowIndex(template, rowId) {
  return template.body.rows.findIndex((row) => row.id === rowId);
}

/**
 * @param {Template} template
 * @param {string} columnId
 * @returns {{ rowIndex: number, columnIndex: number } | null}
 */
export function locateColumn(template, columnId) {
  const { rows } = template.body;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const columnIndex = rows[rowIndex].columns.findIndex((column) => column.id === columnId);
    if (columnIndex !== -1) return { rowIndex, columnIndex };
  }
  return null;
}

/**
 * @param {Template} template
 * @param {string} blockId
 * @returns {{ rowIndex: number, columnIndex: number, blockIndex: number } | null}
 */
export function locateBlock(template, blockId) {
  const { rows } = template.body;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const { columns } = rows[rowIndex];
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
      const blockIndex = columns[columnIndex].blocks.findIndex((block) => block.id === blockId);
      if (blockIndex !== -1) return { rowIndex, columnIndex, blockIndex };
    }
  }
  return null;
}

/**
 * テンプレート内の全 ID（行・カラム・ブロック）
 * @param {Template} template
 * @returns {Set<string>}
 */
export function collectIds(template) {
  const ids = new Set();
  for (const row of template.body.rows) {
    ids.add(row.id);
    for (const column of row.columns) {
      ids.add(column.id);
      for (const block of column.blocks) ids.add(block.id);
    }
  }
  return ids;
}

/**
 * 行の配下の全 ID
 * @param {Row} row
 * @returns {string[]}
 */
export function idsInRow(row) {
  return [
    row.id,
    ...row.columns.flatMap((column) => [column.id, ...column.blocks.map((b) => b.id)]),
  ];
}

/**
 * @param {Template} template
 * @param {Row[]} rows
 * @returns {Template}
 */
export function withRows(template, rows) {
  return { ...template, body: { ...template.body, rows } };
}

/**
 * @param {Template} template
 * @param {number} rowIndex
 * @param {Row} row
 * @returns {Template}
 */
export function replaceRow(template, rowIndex, row) {
  const rows = template.body.rows.slice();
  rows[rowIndex] = row;
  return withRows(template, rows);
}

/**
 * @param {Template} template
 * @param {number} rowIndex
 * @param {number} columnIndex
 * @param {Column} column
 * @returns {Template}
 */
export function replaceColumn(template, rowIndex, columnIndex, column) {
  const row = template.body.rows[rowIndex];
  const columns = row.columns.slice();
  columns[columnIndex] = column;
  return replaceRow(template, rowIndex, { ...row, columns });
}

/**
 * 配列の i 番目を取り除き、to の位置へ入れた新しい配列を返す
 * @template T
 * @param {readonly T[]} list
 * @param {number} from
 * @param {number} to 取り除いた後の配列での挿入位置
 * @returns {T[]}
 */
export function moveItem(list, from, to) {
  const result = list.slice();
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
