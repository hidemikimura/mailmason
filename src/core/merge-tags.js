// マージタグ（差し込み変数）の検出と置換。エディタのハイライト・警告・プレビュー・出力で共通に使う
import { getBlockDef } from './blocks/registry.js';
import { isPlainObject } from './model/utils.js';

/** @import { Template } from './model/types.js' */

/**
 * @typedef {{ open: string, close: string }} MergeTagDelimiters
 */

/** @type {Readonly<MergeTagDelimiters>} */
export const DEFAULT_DELIMITERS = Object.freeze({ open: '{{', close: '}}' });

/** @param {string} value */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * マージタグを検出する正規表現（グループ 1 がキー）。前後の空白は許容する: `{{ name }}`
 * @param {MergeTagDelimiters} [delimiters]
 * @returns {RegExp}
 */
export function mergeTagPattern(delimiters = DEFAULT_DELIMITERS) {
  return new RegExp(
    `${escapeRegExp(delimiters.open)}\\s*([A-Za-z0-9_.-]+)\\s*${escapeRegExp(delimiters.close)}`,
    'g',
  );
}

/**
 * 文字列に含まれるマージタグのキー（出現順、重複あり）
 * @param {string} value
 * @param {MergeTagDelimiters} [delimiters]
 * @returns {string[]}
 */
export function extractMergeTags(value, delimiters = DEFAULT_DELIMITERS) {
  return [...value.matchAll(mergeTagPattern(delimiters))].map((match) => match[1]);
}

/**
 * マージタグを値に置き換える。値が無いキーはタグのまま残す
 * @param {string} value
 * @param {Record<string, string>} values
 * @param {{ delimiters?: MergeTagDelimiters, escape?: (value: string) => string }} [options]
 * @returns {string}
 */
export function replaceMergeTags(value, values, options = {}) {
  const { delimiters = DEFAULT_DELIMITERS, escape = (v) => v } = options;
  return value.replace(mergeTagPattern(delimiters), (match, key) =>
    Object.hasOwn(values, key) && values[key] != null ? escape(String(values[key])) : match,
  );
}

/**
 * @param {unknown} value
 * @param {string[]} out
 */
function collectStrings(value, out) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (isPlainObject(value)) for (const item of Object.values(value)) collectStrings(item, out);
}

/**
 * @param {Record<string, unknown>} values
 * @param {string} path ドット区切り
 * @returns {unknown}
 */
function getByPath(values, path) {
  /** @type {unknown} */
  let current = values;
  for (const key of path.split('.')) {
    if (!isPlainObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * @typedef {Object} MergeTagUsage
 * @property {string} key
 * @property {string | null} blockId ボディ設定（プリヘッダー・タイトル）なら null
 * @property {string} field 例: 'html', 'image.href', 'body.settings.preheader'
 */

/**
 * テンプレート全体で使われているマージタグを列挙する
 * @param {Template} template
 * @param {{ delimiters?: MergeTagDelimiters }} [options]
 * @returns {MergeTagUsage[]}
 */
export function findMergeTags(template, options = {}) {
  const { delimiters = DEFAULT_DELIMITERS } = options;
  /** @type {MergeTagUsage[]} */
  const usages = [];
  for (const field of /** @type {const} */ (['preheader', 'title'])) {
    for (const key of extractMergeTags(template.body.settings[field], delimiters)) {
      usages.push({ key, blockId: null, field: `body.settings.${field}` });
    }
  }
  for (const row of template.body.rows) {
    for (const column of row.columns) {
      for (const block of column.blocks) {
        const def = getBlockDef(block.type);
        if (!def) continue;
        for (const field of def.mergeTagFields) {
          /** @type {string[]} */
          const strings = [];
          collectStrings(getByPath(block.values, field), strings);
          for (const value of strings) {
            for (const key of extractMergeTags(value, delimiters)) {
              usages.push({ key, blockId: block.id, field });
            }
          }
        }
      }
    }
  }
  return usages;
}
