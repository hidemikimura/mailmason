// ブロック定義のレジストリ。標準ブロックに、利用者が defineBlock() で作ったカスタムブロックを足して引く。
// カスタムブロックはグローバルに登録せず、呼び出しごとに `blocks` オプションで渡す
// （エディタは `editor.blocks`、サーバーでは renderHtml(template, { blocks }) など）
import { textBlock } from './text.js';
import { imageBlock } from './image.js';
import { buttonBlock } from './button.js';
import { dividerBlock } from './divider.js';
import { spacerBlock } from './spacer.js';
import { imageTextBlock } from './image-text.js';
import { socialBlock } from './social.js';
import { htmlBlock } from './html.js';
import { qrBlock } from './qr.js';

/** @import { CoreBlockDef } from './types.js' */

/** @type {ReadonlyMap<string, CoreBlockDef>} */
const builtins = new Map(
  [
    textBlock,
    imageBlock,
    buttonBlock,
    dividerBlock,
    spacerBlock,
    imageTextBlock,
    socialBlock,
    qrBlock,
    htmlBlock,
  ].map((def) => [def.type, def]),
);

/** 標準ブロックの type 一覧（パレットの既定の並び順） */
export const BLOCK_TYPES = Object.freeze([...builtins.keys()]);

/**
 * 標準ブロックの type か
 * @param {string} type
 */
export function isBuiltinBlockType(type) {
  return builtins.has(type);
}

/** @type {WeakMap<readonly CoreBlockDef[], ReadonlyMap<string, CoreBlockDef>>} */
const cache = new WeakMap();

/**
 * 標準ブロックとカスタムブロックを合わせたレジストリ（同じ配列なら同じ Map を返す）
 * @param {readonly CoreBlockDef[] | null | undefined} [custom] defineBlock() で作った定義の配列
 * @returns {ReadonlyMap<string, CoreBlockDef>}
 */
export function blockRegistry(custom) {
  if (!custom || custom.length === 0) return builtins;
  let map = cache.get(custom);
  if (!map) {
    const next = new Map(builtins);
    for (const def of custom) {
      if (!builtins.has(def.type)) next.set(def.type, def); // 標準ブロックは上書きさせない
    }
    map = next;
    cache.set(custom, map);
  }
  return map;
}

/**
 * @param {string} type
 * @param {readonly CoreBlockDef[] | null} [custom] カスタムブロックの定義
 * @returns {CoreBlockDef | undefined}
 */
export function getBlockDef(type, custom) {
  return blockRegistry(custom).get(type);
}
