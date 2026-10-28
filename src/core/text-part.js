// テキストパートの自動生成と手編集の関係（どちらを使うか、手編集が古くなっていないか）
import { fnv1a } from './hash.js';
import { migrate } from './migrate/index.js';
import { diffLines } from './text-diff.js';
import { collectText, finishText, renderText, resolveTextOptions } from './render-text/index.js';

/** @import { RenderTextOptions } from './render-text/index.js' */

export { fnv1a };

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
 * @property {boolean} stale 手編集の後に本文が変わった。manual なら全文、auto なら指定の文の部品（staleBlockIds）
 * @property {string[]} staleBlockIds 参照を含まない指定の文を持ち、指定したあとに本文が変わった部品（auto のとき）
 * @property {import('./render-text/index.js').TextRefIssue[]} unknownRefs 指定の文・種類ごとの書き方で、
 *   その部品に無い名前を参照したところ（auto のとき）
 * @property {import('./text-diff.js').TextDiff | null} diff 全文の手編集が古いとき、手編集を始めた時点
 *   （text.sourceText）から今の自動生成までの差分。sourceText が無い古いテンプレートでは null
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
    const current = renderText(template, { ...options, mergeValues: null });
    const stale = template.text.sourceHash !== fnv1a(current);
    const { sourceText } = template.text;
    return {
      text: finishText(template.text.content, resolved, false),
      mode: 'manual',
      stale,
      staleBlockIds: [],
      unknownRefs: [],
      diff: stale && sourceText !== undefined ? diffLines(sourceText, current) : null,
    };
  }
  const { text, unknownRefs, staleBlockIds } = collectText(template, options);
  return {
    text,
    mode: 'auto',
    stale: staleBlockIds.length > 0,
    staleBlockIds,
    unknownRefs,
    diff: null,
  };
}
