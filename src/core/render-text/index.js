// テンプレート → マルチパート配信用のテキストパート
import { getBlockDef } from '../blocks/registry.js';
import { migrate } from '../migrate/index.js';
import { DEFAULT_DELIMITERS, replaceMergeTags } from '../merge-tags.js';
import { fnv1a } from '../hash.js';
import { isPlainObject } from '../model/utils.js';
import { blockRefs, fillRefs, hasRefs, matchesVariant } from '../text-override.js';
import { wrapText } from './wrap.js';

/** @import { ResolvedTextOptions } from '../blocks/types.js' */
/** @import { MergeTagDelimiters } from '../merge-tags.js' */
/** @import { Block, Template } from '../model/types.js' */

/**
 * @typedef {Object} RenderTextOptions
 * @property {number} [wrapWidth] 折り返す桁数（全角 = 2）。0 なら折り返さない（既定）。
 *   差し込み変数の置き換えを配信システムで行うなら 0 を勧める（`{{order_id}}` の長さで数えるため、届くメールで幅がずれる）
 * @property {'\n' | '\r\n'} [newline] 改行コード（既定 '\n'）
 * @property {string} [headingPrefix] 見出しの前に付ける記号（例: '■ '。既定なし）
 * @property {string} [dividerText] 区切り線の文字列（既定は '-' × 40）
 * @property {string} [locale] 既定 'ja'
 * @property {Record<string, string> | null} [mergeValues] 指定するとマージタグを値に置き換える
 * @property {MergeTagDelimiters} [mergeTagDelimiters] 既定 `{{` `}}`
 * @property {readonly import('../blocks/types.js').CoreBlockDef[] | null} [blocks] カスタムブロックの定義
 * @property {import('../text-override.js').TextVariant} [textVariant] PC 用・スマホ用で分けた部品・行（hideOn）のどちらを出すか。
 *   'both'（既定）は両方、'desktop' はスマホだけに出すものを除く、'mobile' は PC だけに出すものを除く
 * @property {Record<string, string>} [textTemplates] 種類ごとの既定の書き方（例: `{ button: '{@label}：{@href}' }`）。
 *   text.mode が自動の部品に使う。`{@名前}` でその部品の今の値、`{@text}` で自動生成のテキストを参照できる
 */

const TEXT_VARIANTS = ['both', 'desktop', 'mobile'];

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
    textVariant: /** @type {import('../text-override.js').TextVariant} */ (
      TEXT_VARIANTS.includes(options.textVariant ?? '') ? options.textVariant : 'both'
    ),
    textTemplates: isPlainObject(options.textTemplates)
      ? Object.fromEntries(
          Object.entries(options.textTemplates).filter(([, value]) => typeof value === 'string'),
        )
      : {},
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
 * @typedef {Object} TextRefIssue
 * @property {string} blockId
 * @property {string} name その部品に無い参照の名前（`{@名前}` の名前）
 */

/**
 * 部品 1 つのテキスト。指定の文（text.mode: 'custom'）か、種類ごとの既定の書き方（textTemplates）があれば
 * それを使い、`{@名前}` を今の値に置き換える。無ければ自動生成。出す・出さないは呼ぶ側で決める
 * @param {Block} block
 * @param {import('../blocks/types.js').CoreBlockDef} def
 * @param {ResolvedTextOptions} resolved
 * @param {TextRefIssue[]} [unknownRefs] 知らない参照を入れる
 * @returns {string}
 */
function blockChunk(block, def, resolved, unknownRefs) {
  const auto = () => def.renderText(block, { options: resolved }).trim();
  const custom = block.text?.mode === 'custom';
  const content = custom ? (block.text?.content ?? '') : resolved.textTemplates[block.type];
  if (content === undefined) return auto();
  // 中身の無い部品（ラベルの無いボタンなど）は、種類ごとの書き方でも出さない
  if (!custom && !auto()) return '';
  const filled = fillRefs(content, blockRefs(block, def), auto);
  for (const name of filled.unknown) unknownRefs?.push({ blockId: block.id, name });
  return filled.text.trim();
}

/**
 * 指定の文の古さの判定に使う、部品の自動生成のハッシュ。折り返しや見出しの記号などの設定に左右されないよう、
 * 言語・区切り・カスタムブロックの定義だけで作る
 * @param {Block} block
 * @param {RenderTextOptions} [options]
 * @returns {string}
 */
export function blockTextSourceHash(block, options = {}) {
  const resolved = resolveTextOptions({
    locale: options.locale,
    mergeTagDelimiters: options.mergeTagDelimiters,
    blocks: options.blocks,
  });
  const def = getBlockDef(block.type, resolved.blocks);
  return fnv1a(def ? def.renderText(block, { options: resolved }).trim() : '');
}

/**
 * 参照を含まない指定の文が、指定したあとに本文が変わって古くなっているか（sourceHash が無ければ判定しない）
 * @param {Block} block
 * @param {RenderTextOptions} [options]
 */
export function isBlockTextStale(block, options = {}) {
  const text = block.text;
  if (text?.mode !== 'custom' || !text.sourceHash || hasRefs(text.content ?? '')) return false;
  return text.sourceHash !== blockTextSourceHash(block, options);
}

/**
 * @typedef {Object} CollectedText
 * @property {string} text 自動生成のテキストパート
 * @property {TextRefIssue[]} unknownRefs
 * @property {string[]} staleBlockIds 古くなった指定の文の部品
 */

/**
 * 正規化済みのテンプレートからテキストパートを作り、参照の問題と古い部品も集める
 * @param {Template} template
 * @param {RenderTextOptions} options
 * @returns {CollectedText}
 */
export function collectText(template, options) {
  const resolved = resolveTextOptions(options);
  /** @type {string[]} */
  const chunks = [];
  /** @type {TextRefIssue[]} */
  const unknownRefs = [];
  /** @type {string[]} */
  const staleBlockIds = [];
  const { textVariant } = resolved;
  for (const row of template.body.rows) {
    // 行の hidden は中の部品の設定より先に効く
    if (row.text?.mode === 'hidden' || !matchesVariant(row.settings.hideOn, textVariant)) continue;
    for (const column of row.columns) {
      for (const block of column.blocks) {
        if (block.text?.mode === 'hidden' || !matchesVariant(block.hideOn, textVariant)) continue;
        const def = getBlockDef(block.type, resolved.blocks);
        if (!def) continue;
        const chunk = blockChunk(block, def, resolved, unknownRefs);
        if (chunk) chunks.push(chunk);
        if (isBlockTextStale(block, options)) staleBlockIds.push(block.id);
      }
    }
  }
  return { text: finishText(chunks.join('\n\n'), resolved, true), unknownRefs, staleBlockIds };
}

/**
 * テンプレートからテキストパートを自動生成する（全文の手編集は見ない）。
 * ブロックを文書順（行ごと、行内は左のカラムから上 → 下）にたどり、空行で区切ってつなぐ。
 *
 * @param {unknown} input テンプレート（オブジェクトまたは JSON 文字列）
 * @param {RenderTextOptions} [options]
 * @returns {string}
 */
export function renderText(input, options = {}) {
  const { template } = migrate(input, {
    mergeTagDelimiters: options.mergeTagDelimiters,
    blocks: options.blocks ?? null,
  });
  return collectText(template, options).text;
}

/**
 * ブロック 1 つがテキストパートに出す内容（エディタの設定欄で見せる用。hidden かどうかは見ない）
 * @param {Block} block 正規化済みのブロック
 * @param {RenderTextOptions} [options]
 * @returns {string}
 */
export function renderBlockText(block, options = {}) {
  const resolved = resolveTextOptions(options);
  const def = getBlockDef(block.type, resolved.blocks);
  if (!def) return '';
  return finishText(blockChunk(block, def, resolved), resolved, true);
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
