// テンプレート → マルチパート配信用のテキストパート
import { getBlockDef } from '../blocks/registry.js';
import { migrate } from '../migrate/index.js';
import { DEFAULT_DELIMITERS, replaceMergeTags } from '../merge-tags.js';
import { wrapText } from './wrap.js';

/** @import { ResolvedTextOptions } from '../blocks/types.js' */
/** @import { MergeTagDelimiters } from '../merge-tags.js' */

/**
 * @typedef {Object} RenderTextOptions
 * @property {number} [wrapWidth] 折り返す桁数（全角 = 2）。0 なら折り返さない（既定）
 * @property {'\n' | '\r\n'} [newline] 改行コード（既定 '\n'）
 * @property {string} [headingPrefix] 見出しの前に付ける記号（例: '■ '。既定なし）
 * @property {string} [dividerText] 区切り線の文字列（既定は '-' × 40）
 * @property {string} [locale] 既定 'ja'
 * @property {Record<string, string> | null} [mergeValues] 指定するとマージタグを値に置き換える
 * @property {MergeTagDelimiters} [mergeTagDelimiters] 既定 `{{` `}}`
 * @property {readonly import('../blocks/types.js').CoreBlockDef[] | null} [blocks] カスタムブロックの定義
 */

/**
 * @param {RenderTextOptions} options
 * @returns {ResolvedTextOptions}
 */
export function resolveTextOptions(options) {
  return {
    wrapWidth: options.wrapWidth ?? 0,
    newline: options.newline ?? '\n',
    headingPrefix: options.headingPrefix ?? '',
    dividerText: options.dividerText ?? '-'.repeat(40),
    locale: options.locale ?? 'ja',
    mergeValues: options.mergeValues ?? null,
    mergeTagDelimiters: options.mergeTagDelimiters ?? DEFAULT_DELIMITERS,
    blocks: options.blocks ?? null,
  };
}

/**
 * 仕上げ: 行末の空白を削り、連続する空行を 1 行にまとめる
 * @param {string} value
 * @returns {string}
 */
function tidy(value) {
  return value
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * テンプレートからテキストパートを自動生成する（手編集の内容は見ない）。
 * ブロックを文書順（行ごと、行内は左のカラムから上 → 下）にたどり、空行で区切ってつなぐ。
 *
 * @param {unknown} input テンプレート（オブジェクトまたは JSON 文字列）
 * @param {RenderTextOptions} [options]
 * @returns {string}
 */
export function renderText(input, options = {}) {
  const resolved = resolveTextOptions(options);
  const { template } = migrate(input, {
    mergeTagDelimiters: resolved.mergeTagDelimiters,
    blocks: resolved.blocks,
  });
  /** @type {string[]} */
  const chunks = [];
  for (const row of template.body.rows) {
    for (const column of row.columns) {
      for (const block of column.blocks) {
        const def = getBlockDef(block.type, resolved.blocks);
        if (!def) continue;
        const chunk = def.renderText(block, { options: resolved }).trim();
        if (chunk) chunks.push(chunk);
      }
    }
  }
  return finishText(chunks.join('\n\n'), resolved, true);
}

/**
 * マージタグ置換 → 折り返し → 改行コード変換
 * @param {string} value
 * @param {ResolvedTextOptions} options
 * @param {boolean} wrap 折り返すか（手編集のテキストは折り返さない）
 * @returns {string}
 */
export function finishText(value, options, wrap) {
  let text = tidy(value.replace(/\r\n?/g, '\n'));
  if (options.mergeValues) {
    text = replaceMergeTags(text, options.mergeValues, { delimiters: options.mergeTagDelimiters });
  }
  if (wrap) text = wrapText(text, options.wrapWidth);
  return options.newline === '\n' ? text : text.replace(/\n/g, options.newline);
}
