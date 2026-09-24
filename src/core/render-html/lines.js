// 出力 HTML を入れ子の構造で組み立てる。wrap() の子が 1 段深いインデントになる。
// 素の配列は同じ深さのまま展開する。minify では改行もインデントも入れずに連結する。

/**
 * @typedef {{ open: string, children: Lines, close: string }} Wrapped
 * @typedef {Array<string | Wrapped | Lines>} Lines
 */

/**
 * 開始タグ・子・終了タグの組を作る（子は 1 段深くなる）
 * @param {string} open
 * @param {Lines} children
 * @param {string} close
 * @returns {Wrapped}
 */
export function wrap(open, children, close) {
  return { open, children, close };
}

/**
 * @param {Lines} lines
 * @param {boolean} pretty
 * @returns {string}
 */
export function renderLines(lines, pretty) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} line @param {number} depth */
  const emit = (line, depth) => {
    if (line !== '') out.push(pretty ? '  '.repeat(depth) + line : line);
  };
  /**
   * @param {Lines} items
   * @param {number} depth
   */
  const walk = (items, depth) => {
    for (const item of items) {
      if (typeof item === 'string') emit(item, depth);
      else if (Array.isArray(item)) walk(item, depth);
      else {
        emit(item.open, depth);
        walk(item.children, depth + 1);
        emit(item.close, depth);
      }
    }
  };
  walk(lines, 0);
  return out.join(pretty ? '\n' : '');
}
