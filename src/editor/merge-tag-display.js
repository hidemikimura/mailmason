// 差し込み変数の表示名。テンプレートにはキー（`{{name}}`）のまま持ち、エディタ上では
// 表示名（`{{氏名}}`）で見せる。入力欄・本文に書かれた表示名は、ストアに送る前にキーへ戻す。
// 書き出し（HTML・テキスト）はテンプレートをそのまま使うので、キーで出る
import { DEFAULT_DELIMITERS } from '../core/merge-tags.js';

/** @import { MergeTag } from './fields/fields.js' */
/** @import { MergeTagDelimiters } from '../core/merge-tags.js' */

/** キーに使える文字（core/merge-tags.js の mergeTagPattern と同じ） */
const KEY_SOURCE = '[A-Za-z0-9_.-]+';

/** @param {string} value */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * HTML に書くときのエスケープ（テキストにも属性値にも使える形）
 * @param {string} value
 */
function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** HTML ではエスケープされている・されていない両方の書き方に合わせる */
const HTML_CHARS = /** @type {Record<string, string>} */ ({
  '&': '(?:&amp;|&)',
  '<': '(?:&lt;|<)',
  '>': '(?:&gt;|>)',
  '"': '(?:&quot;|")',
});

/**
 * 表示名に合う正規表現。空白は改行しない空白（`&nbsp;`）に変わることがあるので、どれでも合わせる
 * @param {string} label
 * @param {boolean} html
 */
function labelSource(label, html) {
  return label
    .split(/(\s+)/)
    .map((part, index) => {
      if (index % 2 === 1) return html ? '(?:\\s|\\u00a0|&nbsp;)+' : '[\\s\\u00a0]+';
      return [...part].map((c) => (html && HTML_CHARS[c]) || escapeRegExp(c)).join('');
    })
    .join('');
}

/**
 * @typedef {Object} MergeTagDisplay
 * @property {(value: string, options?: { html?: boolean }) => string} toLabels キーを表示名にする
 * @property {(value: string, options?: { html?: boolean }) => string} toKeys 表示名をキーに戻す
 * @property {() => RegExp} pattern キー・表示名のどちらで書いたタグにも合う正規表現（ハイライト用）
 * @property {(key: string) => string} text 入力欄・本文に入れるタグの文字列（表示名で）
 */

/**
 * @param {readonly MergeTag[]} tags
 * @param {MergeTagDelimiters} [delimiters]
 * @returns {MergeTagDisplay}
 */
export function createMergeTagDisplay(tags, delimiters = DEFAULT_DELIMITERS) {
  const { open, close } = delimiters;
  const keys = new Set(tags.map((tag) => tag.key));
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const tag of tags) {
    const label = tag.label?.trim() ?? '';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  /** キー → 表示名。キーに戻せなくなる表示名（重複・他のキーと同じ・区切り文字を含む）は使わない */
  /** @type {Map<string, string>} */
  const labels = new Map();
  for (const tag of tags) {
    const label = tag.label?.trim() ?? '';
    if (!label || label === tag.key || labels.has(tag.key)) continue;
    if (counts.get(label) !== 1 || keys.has(label)) continue;
    if (/[\r\n]/.test(label) || label.includes(open) || (close && label.includes(close))) continue;
    labels.set(tag.key, label);
  }
  // 長い表示名から合わせる（「クーポン」と「クーポンの有効期限」など）
  const entries = [...labels].sort((a, b) => b[1].length - a[1].length);
  /** @type {Map<boolean, RegExp | null>} */
  const reverse = new Map();

  /** @param {boolean} html */
  function reverseOf(html) {
    if (!reverse.has(html)) {
      if (entries.length === 0) reverse.set(html, null);
      else {
        const sources = entries.map(([, label]) => `(${labelSource(label, html)})`);
        reverse.set(
          html,
          new RegExp(
            `(${escapeRegExp(open)}\\s*)(?:${sources.join('|')})(\\s*${escapeRegExp(close)})`,
            'g',
          ),
        );
      }
    }
    return reverse.get(html) ?? null;
  }

  const keyPattern = new RegExp(
    `(${escapeRegExp(open)}\\s*)(${KEY_SOURCE})(\\s*${escapeRegExp(close)})`,
    'g',
  );
  const anySource = [...entries.map(([, label]) => labelSource(label, false)), KEY_SOURCE].join(
    '|',
  );

  return {
    toLabels(value, options = {}) {
      if (labels.size === 0 || !value) return value;
      return value.replace(keyPattern, (match, before, key, after) => {
        const label = labels.get(key);
        if (label === undefined) return match;
        return `${before}${options.html ? escapeHtml(label) : label}${after}`;
      });
    },
    toKeys(value, options = {}) {
      const regexp = reverseOf(Boolean(options.html));
      if (!regexp || !value) return value;
      // グループ: 1 = 区切り開始、2.. = 表示名ごと（合ったものだけ値がある）、最後 = 区切り終了
      return value.replace(regexp, (...args) => {
        const groups = /** @type {(string | undefined)[]} */ (args.slice(2, 2 + entries.length));
        const index = groups.findIndex((group) => group !== undefined);
        return `${args[1]}${entries[index][0]}${args[2 + entries.length]}`;
      });
    },
    pattern() {
      return new RegExp(`${escapeRegExp(open)}\\s*(?:${anySource})\\s*${escapeRegExp(close)}`, 'g');
    },
    text(key) {
      return `${open}${labels.get(key) ?? key}${close}`;
    },
  };
}
