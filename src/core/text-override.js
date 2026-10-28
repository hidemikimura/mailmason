// テキストパートでの部品・行の扱い（部品ごとの上書き）。
// 部品と行は省略できる `text` を持ち、無ければ自動（本文から生成）。
// - 部品: auto（既定）/ hidden（テキストパートに出さない）/ only（HTML に出さず、テキストパートだけに出す）
// - 行: auto（既定）/ hidden（行ごと出さない。中の部品の設定より先に効く）
import { child, warn } from './model/schema.js';
import { isPlainObject } from './model/utils.js';

/** @import { NormalizeContext } from './model/schema.js' */
/** @import { Block, BlockText, Row, RowText } from './model/types.js' */

/** 部品で選べる扱い */
export const BLOCK_TEXT_MODES = /** @type {const} */ (['auto', 'hidden', 'only']);

/** 行で選べる扱い */
export const ROW_TEXT_MODES = /** @type {const} */ (['auto', 'hidden']);

/**
 * 部品・行の `text` を整える。自動（auto）なら省く（undefined を返す）
 * @param {unknown} input
 * @param {readonly string[]} modes
 * @param {NormalizeContext} ctx 部品・行の位置（`text` はこの下）
 * @returns {{ mode: string } | undefined}
 */
function normalizeText(input, modes, ctx) {
  if (input === undefined) return undefined;
  const textCtx = child(ctx, 'text');
  if (!isPlainObject(input)) {
    warn(textCtx, 'invalid-value', 'Invalid text; switched to auto.');
    return undefined;
  }
  for (const key of Object.keys(input)) {
    if (key !== 'mode') {
      warn(child(textCtx, key), 'unknown-key', `Unknown key "${key}" was removed.`);
    }
  }
  const { mode } = input;
  if (typeof mode !== 'string' || !modes.includes(mode)) {
    warn(
      child(textCtx, 'mode'),
      'invalid-value',
      `Invalid text mode ${JSON.stringify(mode ?? null)}; switched to auto.`,
    );
    return undefined;
  }
  return mode === 'auto' ? undefined : { mode };
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
