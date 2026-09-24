// ドロップ位置の判定（DOM 非依存の純粋関数）。矩形はドラッグ開始時に測ったものを使う

/**
 * @typedef {{ left: number, top: number, right: number, bottom: number }} Box
 * @typedef {{ id: string, box: Box }} BlockGeo
 * @typedef {{ id: string, rowId: string, box: Box, blocks: BlockGeo[] }} ColumnGeo
 * @typedef {{ id: string, index: number, box: Box, columns: ColumnGeo[] }} RowGeo
 * @typedef {{ mail: Box, rows: RowGeo[] }} Geometry
 */

/**
 * @typedef {{ kind: 'new-block', type: string }
 *   | { kind: 'new-row', layout: import('../../core/model/types.js').RowLayout }
 *   | { kind: 'move-block', blockId: string }
 *   | { kind: 'move-row', rowId: string }} DragPayload
 */

/**
 * @typedef {{ kind: 'column', columnId: string, index: number } | { kind: 'rowGap', index: number }} DropTarget
 *   index は移動元を取り除いた後の位置
 */

/**
 * 挿入位置の表示。line は横線（top に中心）、box は空のカラムの枠
 * @typedef {{ type: 'line' | 'box', left: number, top: number, width: number, height: number }} Indicator
 */

/** 行の上下端からこの距離（px）以内なら、ブロックを「行間（新しい行）」へ落とす */
export const ROW_EDGE = 10;

/**
 * @param {Box} box
 * @returns {number}
 */
const midY = (box) => (box.top + box.bottom) / 2;

/**
 * 行間へのドロップ
 * @param {Geometry} geo
 * @param {RowGeo[]} rows 対象にする行（ドラッグ中の行は除いてある）
 * @param {number} index
 * @returns {{ target: DropTarget, indicator: Indicator }}
 */
function rowGap(geo, rows, index) {
  const top =
    rows.length === 0 ? geo.mail.top : index === 0 ? rows[0].box.top : rows[index - 1].box.bottom;
  return {
    target: { kind: 'rowGap', index },
    indicator: {
      type: 'line',
      left: geo.mail.left,
      top,
      width: geo.mail.right - geo.mail.left,
      height: 0,
    },
  };
}

/**
 * @param {Geometry} geo
 * @param {DragPayload} payload
 * @param {number} x
 * @param {number} y
 * @returns {{ target: DropTarget, indicator: Indicator }}
 */
export function findDropTarget(geo, payload, x, y) {
  // 行のドラッグ: 行間だけが落とし先
  if (payload.kind === 'new-row' || payload.kind === 'move-row') {
    const rows =
      payload.kind === 'move-row' ? geo.rows.filter((row) => row.id !== payload.rowId) : geo.rows;
    const index = rows.filter((row) => midY(row.box) < y).length;
    return rowGap(geo, rows, index);
  }

  // ブロックのドラッグ
  const { rows } = geo;
  if (rows.length === 0) return rowGap(geo, rows, 0);
  if (y < rows[0].box.top) return rowGap(geo, rows, 0);
  if (y > rows[rows.length - 1].box.bottom) return rowGap(geo, rows, rows.length);

  const rowIndex = rows.findIndex((row) => y >= row.box.top && y <= row.box.bottom);
  if (rowIndex === -1) {
    // 行と行の隙間
    return rowGap(geo, rows, rows.filter((row) => row.box.bottom <= y).length);
  }
  const row = rows[rowIndex];
  if (y - row.box.top < ROW_EDGE) return rowGap(geo, rows, rowIndex);
  if (row.box.bottom - y < ROW_EDGE) return rowGap(geo, rows, rowIndex + 1);

  // x に最も近いカラム
  let column = row.columns[0];
  let best = Infinity;
  for (const candidate of row.columns) {
    const { left, right } = candidate.box;
    const distance = x < left ? left - x : x > right ? x - right : 0;
    if (distance < best) {
      best = distance;
      column = candidate;
    }
  }

  const blocks =
    payload.kind === 'move-block'
      ? column.blocks.filter((block) => block.id !== payload.blockId)
      : column.blocks;
  const index = blocks.filter((block) => midY(block.box) < y).length;
  const { left, right } = column.box;

  if (blocks.length === 0) {
    const { top, bottom } = column.box;
    return {
      target: { kind: 'column', columnId: column.id, index: 0 },
      indicator: { type: 'box', left, top, width: right - left, height: bottom - top },
    };
  }
  const lineY = index === 0 ? blocks[0].box.top : blocks[index - 1].box.bottom;
  return {
    target: { kind: 'column', columnId: column.id, index },
    indicator: { type: 'line', left, top: lineY, width: right - left, height: 0 },
  };
}
