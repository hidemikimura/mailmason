// テキストパートの自動生成と手編集の関係（どちらを使うか、手編集が古くなっていないか）
import { migrate } from './migrate/index.js';
import { finishText, renderText, resolveTextOptions } from './render-text/index.js';

/** @import { RenderTextOptions } from './render-text/index.js' */

/**
 * FNV-1a（32bit）。暗号用途ではなく、変化の検出用
 * @param {string} value
 * @returns {string} 8 桁の 16 進数
 */
export function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * 手編集を始めるときに `text.sourceHash` に保存する値（その時点の自動生成テキストのハッシュ）
 * @param {unknown} input
 * @param {RenderTextOptions} [options] マージタグ置換は無視する
 * @returns {string}
 */
export function textSourceHash(input, options = {}) {
  return fnv1a(renderText(input, { ...options, mergeValues: null }));
}

/**
 * @typedef {Object} ResolvedTextPart
 * @property {string} text 配信に使うテキスト
 * @property {'auto' | 'manual'} mode
 * @property {boolean} stale 手編集の後に HTML 側が変わった（manual のときだけ true になりうる）
 */

/**
 * 配信に使うテキストパートを決める。manual なら手編集の内容、auto なら自動生成
 * @param {unknown} input
 * @param {RenderTextOptions} [options]
 * @returns {ResolvedTextPart}
 */
export function resolveTextPart(input, options = {}) {
  const resolved = resolveTextOptions(options);
  const { template } = migrate(input, {
    mergeTagDelimiters: resolved.mergeTagDelimiters,
    blocks: resolved.blocks,
  });
  if (template.text.mode === 'manual' && template.text.content !== null) {
    const stale = template.text.sourceHash !== textSourceHash(template, options);
    return { text: finishText(template.text.content, resolved, false), mode: 'manual', stale };
  }
  return { text: renderText(template, options), mode: 'auto', stale: false };
}
