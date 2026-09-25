// 表のセルの結合と、行・列の並べ替えの計算（DOM を使わない純粋関数）。
// 結合は左上のセル（アンカー）の位置と、行・列の数で表す。結合に覆われたセルの値は残すが、出力には使わない

/**
 * @typedef {Object} TableMerge
 * @property {number} row 左上のセルの行
 * @property {number} column 左上のセルの列
 * @property {number} rowSpan 縦に結合する行の数（1 以上）
 * @property {number} colSpan 横に結合する列の数（1 以上）
 */

/** @typedef {TableMerge} TableRange 選択範囲（結合と同じ形） */

/** @typedef {'row' | 'column'} Axis */

const KEYS = /** @type {const} */ ({
  row: { pos: 'row', span: 'rowSpan' },
  column: { pos: 'column', span: 'colSpan' },
});

/**
 * 2 つの範囲が重なるか
 * @param {TableRange} a
 * @param {TableRange} b
 */
export function rangesIntersect(a, b) {
  return (
    a.row < b.row + b.rowSpan &&
    b.row < a.row + a.rowSpan &&
    a.column < b.column + b.colSpan &&
    b.column < a.column + a.colSpan
  );
}

/**
 * a が b をすべて含むか
 * @param {TableRange} a
 * @param {TableRange} b
 */
function contains(a, b) {
  return (
    a.row <= b.row &&
    a.column <= b.column &&
    b.row + b.rowSpan <= a.row + a.rowSpan &&
    b.column + b.colSpan <= a.column + a.colSpan
  );
}

/**
 * 結合を表の大きさに収め、重なり（先にあるものを優先）と 1 セルだけの結合を除き、左上から順に並べる
 * @param {readonly TableMerge[]} merges
 * @param {number} rows
 * @param {number} columns
 * @returns {TableMerge[]}
 */
export function normalizeMerges(merges, rows, columns) {
  /** @type {TableMerge[]} */
  const out = [];
  for (const m of merges) {
    if (m.row >= rows || m.column >= columns) continue;
    const merge = {
      row: m.row,
      column: m.column,
      rowSpan: Math.min(m.rowSpan, rows - m.row),
      colSpan: Math.min(m.colSpan, columns - m.column),
    };
    if (merge.rowSpan * merge.colSpan <= 1) continue;
    if (out.some((other) => rangesIntersect(other, merge))) continue;
    out.push(merge);
  }
  return out.sort((a, b) => a.row - b.row || a.column - b.column);
}

/**
 * セルを含む結合（無ければ null）
 * @param {readonly TableMerge[]} merges
 * @param {number} row
 * @param {number} column
 * @returns {TableMerge | null}
 */
export function mergeAt(merges, row, column) {
  return (
    merges.find(
      (m) =>
        m.row <= row &&
        row < m.row + m.rowSpan &&
        m.column <= column &&
        column < m.column + m.colSpan,
    ) ?? null
  );
}

/**
 * セルが属する範囲（結合されていなければそのセルだけ）
 * @param {readonly TableMerge[]} merges
 * @param {number} row
 * @param {number} column
 * @returns {TableRange}
 */
export function cellRange(merges, row, column) {
  const m = mergeAt(merges, row, column);
  return m ? { ...m } : { row, column, rowSpan: 1, colSpan: 1 };
}

/**
 * 結合に覆われていて表示しないセルか（左上のセルは false）
 * @param {readonly TableMerge[]} merges
 * @param {number} row
 * @param {number} column
 */
export function isCovered(merges, row, column) {
  const m = mergeAt(merges, row, column);
  return m !== null && (m.row !== row || m.column !== column);
}

/**
 * 範囲にかかる結合をすべて含むまで広げる
 * @param {readonly TableMerge[]} merges
 * @param {TableRange} range
 * @returns {TableRange}
 */
export function expandRange(merges, range) {
  let r = { ...range };
  for (let changed = true; changed;) {
    changed = false;
    for (const m of merges) {
      if (!rangesIntersect(m, r) || contains(r, m)) continue;
      const top = Math.min(r.row, m.row);
      const left = Math.min(r.column, m.column);
      r = {
        row: top,
        column: left,
        rowSpan: Math.max(r.row + r.rowSpan, m.row + m.rowSpan) - top,
        colSpan: Math.max(r.column + r.colSpan, m.column + m.colSpan) - left,
      };
      changed = true;
    }
  }
  return r;
}

/**
 * 2 つのセルを角にする範囲（結合を含むまで広げる）
 * @param {readonly TableMerge[]} merges
 * @param {{ row: number, column: number }} a
 * @param {{ row: number, column: number }} b
 * @returns {TableRange}
 */
export function rangeBetween(merges, a, b) {
  const row = Math.min(a.row, b.row);
  const column = Math.min(a.column, b.column);
  return expandRange(merges, {
    row,
    column,
    rowSpan: Math.abs(a.row - b.row) + 1,
    colSpan: Math.abs(a.column - b.column) + 1,
  });
}

/**
 * 行（列）を index の位置に 1 つ足したときの結合。結合の途中に足すと結合を広げる
 * @param {readonly TableMerge[]} merges
 * @param {Axis} axis
 * @param {number} index
 * @returns {TableMerge[]}
 */
export function mergesAfterInsert(merges, axis, index) {
  const { pos, span } = KEYS[axis];
  return merges.map((m) => {
    if (index <= m[pos]) return { ...m, [pos]: m[pos] + 1 };
    if (index < m[pos] + m[span]) return { ...m, [span]: m[span] + 1 };
    return { ...m };
  });
}

/**
 * 行（列）を 1 つ消したときの結合。消した行（列）の分だけ結合を縮め、1 セルになった結合は除く
 * @param {readonly TableMerge[]} merges
 * @param {Axis} axis
 * @param {number} index
 * @returns {TableMerge[]}
 */
export function mergesAfterRemove(merges, axis, index) {
  const { pos, span } = KEYS[axis];
  return merges
    .map((m) => {
      if (index < m[pos]) return { ...m, [pos]: m[pos] - 1 };
      if (index < m[pos] + m[span]) return { ...m, [span]: m[span] - 1 };
      return { ...m };
    })
    .filter((m) => m.rowSpan > 0 && m.colSpan > 0 && m.rowSpan * m.colSpan > 1);
}

/**
 * 行（列）のまとまり: start〜end を、縦（横）の結合を途中で切らない最小の範囲に広げる
 * @param {readonly TableMerge[]} merges
 * @param {Axis} axis
 * @param {number} start
 * @param {number} end 最後の行（列）の位置（含む）
 * @returns {{ start: number, end: number }}
 */
export function lineGroup(merges, axis, start, end) {
  const { pos, span } = KEYS[axis];
  let a = start;
  let b = end;
  for (let changed = true; changed;) {
    changed = false;
    for (const m of merges) {
      if (m[span] <= 1) continue;
      const first = m[pos];
      const last = m[pos] + m[span] - 1;
      if (last < a || first > b) continue;
      if (first < a || last > b) {
        a = Math.min(a, first);
        b = Math.max(b, last);
        changed = true;
      }
    }
  }
  return { start: a, end: b };
}

/**
 * 行（列）の start から count 個を、元の位置で数えた gap（0〜total）の前に移す。
 * 結合が途中で切れる移動と、位置が変わらない移動は null
 * @param {readonly TableMerge[]} merges
 * @param {Axis} axis
 * @param {number} total 行（列）の数
 * @param {number} start
 * @param {number} count
 * @param {number} gap
 * @returns {{ order: number[], merges: TableMerge[] } | null} order は新しい位置 → 元の位置
 */
export function moveLines(merges, axis, total, start, count, gap) {
  if (count < 1 || start < 0 || start + count > total || gap < 0 || gap > total) return null;
  if (gap >= start && gap <= start + count) return null;
  const indices = Array.from({ length: total }, (_, i) => i);
  const block = indices.slice(start, start + count);
  const rest = indices.filter((i) => i < start || i >= start + count);
  const at = gap < start ? gap : gap - count;
  const order = [...rest.slice(0, at), ...block, ...rest.slice(at)];
  /** @type {number[]} 元の位置 → 新しい位置 */
  const position = [];
  order.forEach((old, i) => (position[old] = i));
  const { pos, span } = KEYS[axis];
  /** @type {TableMerge[]} */
  const next = [];
  for (const m of merges) {
    const first = position[m[pos]];
    for (let k = 1; k < m[span]; k += 1) {
      if (position[m[pos] + k] !== first + k) return null;
    }
    next.push({ ...m, [pos]: first });
  }
  return { order, merges: next.sort((a, b) => a.row - b.row || a.column - b.column) };
}

/**
 * ボタンで 1 つ上（左）・下（右）に移すときの移動先。隣のまとまりを飛び越える。動かせなければ null
 * @param {readonly TableMerge[]} merges
 * @param {Axis} axis
 * @param {number} total
 * @param {number} start
 * @param {number} end
 * @param {-1 | 1} direction
 * @returns {{ start: number, count: number, gap: number } | null}
 */
export function shiftTarget(merges, axis, total, start, end, direction) {
  const group = lineGroup(merges, axis, start, end);
  const count = group.end - group.start + 1;
  if (direction < 0) {
    if (group.start === 0) return null;
    const prev = lineGroup(merges, axis, group.start - 1, group.start - 1);
    return { start: group.start, count, gap: prev.start };
  }
  if (group.end >= total - 1) return null;
  const next = lineGroup(merges, axis, group.end + 1, group.end + 1);
  return { start: group.start, count, gap: next.end + 1 };
}
