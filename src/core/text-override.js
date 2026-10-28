// テキストパートでの部品・行の扱い（部品ごとの上書き）。
// 部品と行は省略できる `text` を持ち、無ければ自動（本文から生成）。
// - 部品: auto（既定）/ hidden（テキストパートに出さない）/ only（HTML に出さず、テキストパートだけに出す）
//         / custom（指定の文。`{@名前}` でその部品の今の値を参照できる）
// - 行: auto（既定）/ hidden（行ごと出さない。中の部品の設定より先に効く）
import { child, warn } from './model/schema.js';
import { isPlainObject } from './model/utils.js';

/** @import { NormalizeContext } from './model/schema.js' */
/** @import { Block, BlockText, Row, RowText } from './model/types.js' */
/** @import { CoreBlockDef } from './blocks/types.js' */

/** 部品で選べる扱い */
export const BLOCK_TEXT_MODES = /** @type {const} */ (['auto', 'hidden', 'only', 'custom']);

/** 行で選べる扱い */
export const ROW_TEXT_MODES = /** @type {const} */ (['auto', 'hidden']);

/**
 * 部品・行の `text` を整える。自動（auto）なら省く（undefined を返す）
 * @param {unknown} input
 * @param {readonly string[]} modes
 * @param {NormalizeContext} ctx 部品・行の位置（`text` はこの下）
 * @returns {{ mode: string, content?: string, sourceHash?: string } | undefined}
 */
function normalizeText(input, modes, ctx) {
  if (input === undefined) return undefined;
  const textCtx = child(ctx, 'text');
  if (!isPlainObject(input)) {
    warn(textCtx, 'invalid-value', 'Invalid text; switched to auto.');
    return undefined;
  }
  const { mode, content, sourceHash } = input;
  if (typeof mode !== 'string' || !modes.includes(mode)) {
    warn(
      child(textCtx, 'mode'),
      'invalid-value',
      `Invalid text mode ${JSON.stringify(mode ?? null)}; switched to auto.`,
    );
    return undefined;
  }
  const custom = mode === 'custom';
  const known = custom ? ['mode', 'content', 'sourceHash'] : ['mode'];
  for (const key of Object.keys(input)) {
    if (!known.includes(key)) {
      warn(child(textCtx, key), 'unknown-key', `Unknown key "${key}" was removed.`);
    }
  }
  if (mode === 'auto') return undefined;
  if (!custom) return { mode };
  if (typeof content !== 'string') {
    warn(
      child(textCtx, 'content'),
      'invalid-value',
      'Custom text without content; switched to auto.',
    );
    return undefined;
  }
  if (sourceHash === undefined || sourceHash === null) return { mode, content };
  if (typeof sourceHash !== 'string') {
    warn(child(textCtx, 'sourceHash'), 'invalid-value', 'Invalid sourceHash; it was removed.');
    return { mode, content };
  }
  return { mode, content, sourceHash };
}

/**
 * @param {unknown} input
 * @param {NormalizeContext} ctx
 * @returns {BlockText | undefined}
 */
export function normalizeBlockText(input, ctx) {
  return /** @type {BlockText | undefined} */ (normalizeText(input, BLOCK_TEXT_MODES, ctx));
}

/**
 * @param {unknown} input
 * @param {NormalizeContext} ctx
 * @returns {RowText | undefined}
 */
export function normalizeRowText(input, ctx) {
  return /** @type {RowText | undefined} */ (normalizeText(input, ROW_TEXT_MODES, ctx));
}

// ---- 部品の値の参照（`{@名前}`） -------------------------------------------

/** `{@名前}`。名前は英字で始まる英数字と `_` */
const REF_PATTERN = /\{@([A-Za-z][A-Za-z0-9_]*)\}/g;

/** 部品の自動生成のテキストを参照する名前（どの種類でも使える） */
export const AUTO_TEXT_REF = 'text';

/**
 * 標準の部品で参照できる名前と値。values の形とは切り離して公開する（values の中を後から変えられるように）
 * @type {Record<string, (values: any) => Record<string, string>>}
 */
const BUILTIN_REFS = {
  image: (v) => ({ alt: v.alt, href: v.href, src: v.src }),
  imageText: (v) => ({ alt: v.image.alt, href: v.image.href, src: v.image.src }),
  button: (v) => ({ label: v.label, href: v.href }),
  qr: (v) => ({ content: v.content, alt: v.alt, href: v.href, src: v.src }),
  video: (v) => ({ url: v.url, alt: v.thumbnail.alt }),
};

/**
 * 部品で参照できる値（`{@text}` は含めない）。カスタムブロックは、文字・数の値の項目をそのまま使う
 * @param {Block} block
 * @param {CoreBlockDef | null} def
 * @returns {Record<string, string>}
 */
export function blockRefs(block, def) {
  const builtin = BUILTIN_REFS[block.type];
  if (builtin) return builtin(block.values);
  if (!def || !(/** @type {{ custom?: boolean }} */ (def).custom)) return {};
  /** @type {Record<string, string>} */
  const refs = {};
  for (const [key, value] of Object.entries(block.values)) {
    if (typeof value === 'string' || typeof value === 'number') refs[key] = String(value);
  }
  return refs;
}

/**
 * 文が参照を含むか（含まない指定の文は本文と切れるので、古さを判定する）
 * @param {string} content
 */
export function hasRefs(content) {
  return new RegExp(REF_PATTERN.source).test(content);
}

/**
 * `{@名前}` を値に置き換える。知らない名前は書いたまま残し、unknown に入れる
 * @param {string} content
 * @param {Record<string, string>} refs
 * @param {() => string} autoText `{@text}` の値（使うときだけ作る）
 * @returns {{ text: string, unknown: string[] }}
 */
export function fillRefs(content, refs, autoText) {
  /** @type {string[]} */
  const unknown = [];
  const text = content.replace(REF_PATTERN, (match, name) => {
    if (name === AUTO_TEXT_REF) return autoText();
    if (Object.hasOwn(refs, name)) return refs[name];
    if (!unknown.includes(name)) unknown.push(name);
    return match;
  });
  return { text, unknown };
}

/**
 * 部品・行の `text` を付け替えたものを返す（auto なら `text` を省く）。入力は変更しない
 * @template {Block | Row} T
 * @param {T} element
 * @param {{ mode: string } | undefined} text
 * @returns {T}
 */
export function withText(element, text) {
  if (text) return { ...element, text };
  const rest = { ...element };
  delete (/** @type {{ text?: unknown }} */ (rest).text);
  return rest;
}

/**
 * HTML に出す部品か（テキストパートだけに出す部品は出さない）
 * @param {Block} block
 */
export function isInHtml(block) {
  return block.text?.mode !== 'only';
}

/**
 * @typedef {'both' | 'desktop' | 'mobile'} TextVariant
 *   PC 用・スマホ用で分けた部品・行（hideOn）のどちらをテキストパートに出すか。both は両方
 */

/**
 * 端末の分け方（hideOn）から見て、テキストパートに出すか
 * @param {'mobile' | 'desktop' | null} hideOn
 * @param {TextVariant} variant
 */
export function matchesVariant(hideOn, variant) {
  if (variant === 'desktop') return hideOn !== 'desktop'; // スマホだけに出すものは出さない
  if (variant === 'mobile') return hideOn !== 'mobile'; // PC だけに出すものは出さない
  return true;
}
