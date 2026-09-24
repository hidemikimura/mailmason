// 文字幅（East Asian Width の全角 = 2、それ以外 = 1）。折り返しとボタン幅の推定に使う

/** @type {Array<[number, number]>} 全角として扱う範囲（F / W と主な絵文字） */
const WIDE_RANGES = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xa960, 0xa97f],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f900, 0x1f9ff],
  [0x20000, 0x3fffd],
];

/**
 * @param {number} codePoint
 * @returns {boolean}
 */
export function isWide(codePoint) {
  for (const [start, end] of WIDE_RANGES) {
    if (codePoint < start) return false;
    if (codePoint <= end) return true;
  }
  return false;
}

/**
 * 表示幅（半角 = 1、全角 = 2）
 * @param {string} value
 * @returns {number}
 */
export function stringWidth(value) {
  let width = 0;
  for (const char of value) {
    const cp = /** @type {number} */ (char.codePointAt(0));
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0) || cp === 0x200b || cp === 0x200c || cp === 0x200d) {
      continue;
    }
    width += isWide(cp) ? 2 : 1;
  }
  return width;
}

/**
 * ボタンなどの文字列の描画幅（px）を推定する。VML の幅指定に使う近似値
 * @param {string} value
 * @param {number} fontSize
 * @param {boolean} [bold]
 * @returns {number}
 */
export function estimateTextWidth(value, fontSize, bold = false) {
  let width = 0;
  for (const char of value) {
    const cp = /** @type {number} */ (char.codePointAt(0));
    width += isWide(cp) ? fontSize : fontSize * 0.55;
  }
  return Math.ceil(width * (bold ? 1.08 : 1));
}
