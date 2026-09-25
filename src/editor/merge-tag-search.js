// 差し込み変数の候補の絞り込みと、入力中の区切り開始文字（`{{` など）の検出。DOM に依存しない

/** @import { MergeTag } from './fields/fields.js' */
/** @import { MergeTagDelimiters } from '../core/merge-tags.js' */

/**
 * @typedef {Object} MergeTagGroup
 * @property {string | null} name グループ名（group の無い候補は null。グループがある候補と混ざるときは最後に並べる）
 * @property {MergeTag[]} tags
 */

/** 入力中とみなす区切り開始文字の後ろの文字数の上限 */
const MAX_QUERY_LENGTH = 40;

/**
 * 比べやすい形にする（全角英数を半角に、大文字を小文字に）
 * @param {string} value
 */
export function normalizeForSearch(value) {
  return value.normalize('NFKC').toLowerCase();
}

/**
 * 候補を絞り込み、グループごとにまとめる。検索語を空白で区切った語がすべて、
 * グループ名・表示名・キーのどれかに含まれる候補を残す（並び順は候補の順のまま）
 * @param {readonly MergeTag[]} tags
 * @param {string} query
 * @returns {MergeTagGroup[]}
 */
export function filterMergeTags(tags, query) {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  /** @type {Map<string | null, MergeTag[]>} */
  const groups = new Map();
  for (const tag of tags) {
    const haystack = normalizeForSearch(`${tag.group ?? ''}\n${tag.label}\n${tag.key}`);
    if (!terms.every((term) => haystack.includes(term))) continue;
    const name = tag.group || null;
    const list = groups.get(name);
    if (list) list.push(tag);
    else groups.set(name, [tag]);
  }
  const named = [...groups].filter(([name]) => name !== null);
  const rest = groups.get(null);
  return [
    ...named.map(([name, list]) => ({ name, tags: list })),
    ...(rest ? [{ name: null, tags: rest }] : []),
  ];
}

/**
 * キャレットの直前が「区切り開始文字＋入力中の文字」なら、その位置と入力中の文字を返す。
 * 区切り終了文字や改行を含む場合、長すぎる場合は入力中とみなさない
 * @param {string} textBeforeCaret キャレットより前の文字列
 * @param {MergeTagDelimiters} delimiters
 * @returns {{ start: number, query: string } | null} start は区切り開始文字の位置
 */
export function findMergeTagTrigger(textBeforeCaret, delimiters) {
  const start = textBeforeCaret.lastIndexOf(delimiters.open);
  if (start === -1) return null;
  // 開始と終了が同じ文字（`%%name%%` など）なら、その前までの数が奇数のときだけ入力中（偶数ならタグの外）
  if (delimiters.open === delimiters.close) {
    const count = textBeforeCaret.split(delimiters.open).length - 1;
    if (count % 2 === 0) return null;
  }
  const query = textBeforeCaret.slice(start + delimiters.open.length);
  if (query.length > MAX_QUERY_LENGTH) return null;
  if (/[\n\r]/.test(query)) return null;
  if (delimiters.close && query.includes(delimiters.close)) return null;
  // 区切り開始文字の最初の 1 文字が続くとき（`{{{` など）は、後ろの `{{` で判定し直す
  if (query.startsWith(delimiters.open[0])) return null;
  return { start, query: query.trimStart() };
}

/**
 * マージタグの文字列
 * @param {string} key
 * @param {MergeTagDelimiters} delimiters
 */
export function mergeTagText(key, delimiters) {
  return `${delimiters.open}${key}${delimiters.close}`;
}
