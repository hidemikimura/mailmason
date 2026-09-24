// テキストの折り返し（全角 = 2 桁）。URL と英単語は途中で切らない。
// 行頭に来てはいけない約物は前の行に残す（ぶら下げ）
import { stringWidth } from '../text/width.js';

const NO_LINE_START = new Set([
  ...'、。，．・：；？！゛゜ヽヾゝゞ々ー）］｝」』】〉》〕’”～…‥',
  ...',.)]}!?:;%',
]);

const TOKEN = /(https?:\/\/\S+|mailto:\S+)|([\x21-\x7e]+)|([ \t]+)|([\s\S])/gu;

/** 箇条書きの記号（続きの行をそろえるため） */
const MARKER = /^(\s*(?:・|\d+\. |▶ ))/;

/**
 * 1 行を折り返す
 * @param {string} line
 * @param {number} width
 * @returns {string[]}
 */
function wrapLine(line, width) {
  if (stringWidth(line) <= width) return [line];
  // 区切り線のような同じ文字の繰り返しは折り返さずに行幅で切る
  if (/^(\S)\1+$/u.test(line)) {
    let cut = '';
    for (const char of line) {
      if (stringWidth(cut + char) > width) break;
      cut += char;
    }
    return [cut];
  }
  const marker = MARKER.exec(line);
  const hangIndent = marker ? ' '.repeat(stringWidth(marker[1])) : '';
  /** @type {string[]} */
  const lines = [];
  let current = '';
  let currentWidth = 0;

  /** @param {string} token */
  const push = (token) => {
    current += token;
    currentWidth += stringWidth(token);
  };
  const breakLine = () => {
    lines.push(current.replace(/[ \t]+$/, ''));
    current = hangIndent;
    currentWidth = stringWidth(hangIndent);
  };

  for (const match of line.matchAll(TOKEN)) {
    const [token, url, , space] = match;
    const tokenWidth = stringWidth(token);
    const atLineStart = current.trim() === '';

    if (space !== undefined) {
      if (!atLineStart || lines.length === 0) push(token);
      continue;
    }
    if (currentWidth + tokenWidth <= width || atLineStart) {
      // 1 語が行幅を超えるときは文字単位で切る（URL は切らない）
      if (tokenWidth > width && url === undefined && token.length > 1) {
        for (const char of token) {
          if (currentWidth + stringWidth(char) > width && current.trim() !== '') breakLine();
          push(char);
        }
      } else {
        push(token);
      }
      continue;
    }
    if (token.length === 1 && NO_LINE_START.has(token)) {
      push(token); // ぶら下げ
      continue;
    }
    breakLine();
    if (tokenWidth > width && url === undefined && token.length > 1) {
      for (const char of token) {
        if (currentWidth + stringWidth(char) > width && current.trim() !== '') breakLine();
        push(char);
      }
    } else {
      push(token);
    }
  }
  if (current.trim() !== '') lines.push(current.replace(/[ \t]+$/, ''));
  return lines;
}

/**
 * テキスト全体を折り返す
 * @param {string} value
 * @param {number} width 0 以下なら折り返さない
 * @returns {string}
 */
export function wrapText(value, width) {
  if (width <= 0) return value;
  return value
    .split('\n')
    .flatMap((line) => wrapLine(line, width))
    .join('\n');
}
