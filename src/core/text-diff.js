// 行ごとの差分。全文を手で直したテキストパートで、手直しを始めたあとに本文の自動生成がどう変わったかを見せ、
// 変わったところを手直しの文に取り込むのに使う

/**
 * 変わった行の中の違い（前後の同じ部分と、違う部分）
 * @typedef {Object} TextDiffLineChange
 * @property {string} prefix 前の同じ部分
 * @property {string} removed 消えた部分
 * @property {string} added 増えた部分
 * @property {string} suffix 後ろの同じ部分
 */

/**
 * ひとまとまりの変更
 * @typedef {Object} TextDiffHunk
 * @property {number} start 変更前のテキストで、変更が始まる行（0 から）
 * @property {string[]} removed 消えた行
 * @property {string[]} added 増えた行
 * @property {TextDiffLineChange[]} changes 消えた行と増えた行を先頭から組にした、行の中の違い
 */

/**
 * @typedef {Object} TextDiff
 * @property {TextDiffHunk[]} hunks
 * @property {number} added 増えた行の数
 * @property {number} removed 消えた行の数
 */

/** 最長共通部分列を表で求める上限（行数 × 行数）。超えたら残りをまとめて 1 つの変更にする */
const MAX_CELLS = 4_000_000;

/**
 * @param {string} before
 * @param {string} after
 * @returns {TextDiffLineChange}
 */
function lineChange(before, after) {
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head++;
  let tail = 0;
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail++;
  }
  return {
    prefix: before.slice(0, head),
    removed: before.slice(head, before.length - tail),
    added: after.slice(head, after.length - tail),
    suffix: before.slice(before.length - tail),
  };
}

/**
 * @param {number} start
 * @param {string[]} removed
 * @param {string[]} added
 * @returns {TextDiffHunk}
 */
function hunk(start, removed, added) {
  const pairs = Math.min(removed.length, added.length);
  const changes = [];
  for (let i = 0; i < pairs; i++) changes.push(lineChange(removed[i], added[i]));
  return { start, removed, added, changes };
}

/**
 * 2 つのテキストの行ごとの差分
 * @param {string} before
 * @param {string} after
 * @returns {TextDiff}
 */
export function diffLines(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  // 前後の同じ行は表に入れない（変わるのは一部のことが多い）
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail++;
  }
  const x = a.slice(head, a.length - tail);
  const y = b.slice(head, b.length - tail);

  /** @type {TextDiffHunk[]} */
  const hunks = [];
  if (x.length * y.length > MAX_CELLS) {
    hunks.push(hunk(head, x, y));
  } else if (x.length > 0 || y.length > 0) {
    // lcs[i][j]: x[i..] と y[j..] の最長共通部分列の長さ
    const width = y.length + 1;
    const lcs = new Uint32Array((x.length + 1) * width);
    for (let i = x.length - 1; i >= 0; i--) {
      for (let j = y.length - 1; j >= 0; j--) {
        lcs[i * width + j] =
          x[i] === y[j]
            ? lcs[(i + 1) * width + j + 1] + 1
            : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    /** @type {string[]} */
    let removed = [];
    /** @type {string[]} */
    let added = [];
    let start = head;
    const flush = () => {
      if (removed.length > 0 || added.length > 0) hunks.push(hunk(start, removed, added));
      removed = [];
      added = [];
    };
    while (i < x.length || j < y.length) {
      if (i < x.length && j < y.length && x[i] === y[j]) {
        flush();
        i++;
        j++;
        start = head + i;
      } else if (
        j >= y.length ||
        (i < x.length && lcs[(i + 1) * width + j] >= lcs[i * width + j + 1])
      ) {
        removed.push(x[i++]);
      } else {
        added.push(y[j++]);
      }
    }
    flush();
  }
  return {
    hunks,
    added: hunks.reduce((sum, h) => sum + h.added.length, 0),
    removed: hunks.reduce((sum, h) => sum + h.removed.length, 0),
  };
}

/**
 * lines の中で、part が最初に現れる位置（無ければ -1）
 * @param {string[]} lines
 * @param {string[]} part
 */
function indexOfLines(lines, part) {
  for (let i = 0; i + part.length <= lines.length; i++) {
    if (part.every((line, k) => lines[i + k] === line)) return i;
  }
  return -1;
}

/**
 * 変更を手直しの文に取り込む。消えた行を手直しの文から探して置き換える（行を足すだけの変更は、
 * 変更前のテキストで直前にあった行の後ろに入れる）。見つからなければ null
 * @param {string} content 手直しの文
 * @param {TextDiffHunk} change
 * @param {string} base 差分の変更前のテキスト（手直しを始めたときの自動生成）
 * @returns {string | null}
 */
export function applyHunk(content, change, base) {
  const lines = content.split('\n');
  if (change.removed.length > 0) {
    const at = indexOfLines(lines, change.removed);
    if (at === -1) return null;
    lines.splice(at, change.removed.length, ...change.added);
    return lines.join('\n');
  }
  if (change.start === 0) return [...change.added, ...lines].join('\n');
  const anchor = base.split('\n')[change.start - 1];
  const at = lines.indexOf(anchor);
  if (at === -1) return null;
  lines.splice(at + 1, 0, ...change.added);
  return lines.join('\n');
}

/**
 * 変更前のテキストに変更を当てる（変更前のテキストでの位置で当てるので、必ず当たる）
 * @param {string} base
 * @param {TextDiffHunk} change
 * @returns {string}
 */
export function applyHunkToBase(base, change) {
  const lines = base.split('\n');
  lines.splice(change.start, change.removed.length, ...change.added);
  return lines.join('\n');
}
