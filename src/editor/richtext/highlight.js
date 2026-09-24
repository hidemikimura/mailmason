// マージタグのハイライト（CSS Custom Highlight API）。DOM を書き換えずに色を付けるので、
// 保存される HTML に装飾が混ざらない。未対応のブラウザでは何もしない。
import { mergeTagPattern } from '../../core/merge-tags.js';

/** @import { MergeTagDelimiters } from '../../core/merge-tags.js' */

export const HIGHLIGHT_NAME = 'mm-merge-tag';

/** @type {Map<object, Range[]>} 持ち主（コンポーネント）ごとの範囲 */
const owners = new Map();

function supported() {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

function flush() {
  if (!supported()) return;
  const ranges = [...owners.values()].flat();
  if (ranges.length === 0) CSS.highlights.delete(HIGHLIGHT_NAME);
  else CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
}

/**
 * root の中のテキストからマージタグを探してハイライトする
 * @param {object} owner 呼び出し元（解除に使う）
 * @param {Node | null} root
 * @param {MergeTagDelimiters} delimiters
 */
export function highlightMergeTags(owner, root, delimiters) {
  if (!supported()) return;
  /** @type {Range[]} */
  const ranges = [];
  if (root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue ?? '';
      for (const match of text.matchAll(mergeTagPattern(delimiters))) {
        const range = document.createRange();
        range.setStart(node, match.index ?? 0);
        range.setEnd(node, (match.index ?? 0) + match[0].length);
        ranges.push(range);
      }
    }
  }
  if (ranges.length === 0) owners.delete(owner);
  else owners.set(owner, ranges);
  flush();
}

/** @param {object} owner */
export function clearHighlights(owner) {
  if (owners.delete(owner)) flush();
}
