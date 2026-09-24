// コア側ブロック定義のレジストリ（v1 では内部 API）
import { textBlock } from './text.js';
import { imageBlock } from './image.js';
import { buttonBlock } from './button.js';
import { dividerBlock } from './divider.js';
import { spacerBlock } from './spacer.js';
import { imageTextBlock } from './image-text.js';
import { socialBlock } from './social.js';
import { htmlBlock } from './html.js';

/** @import { CoreBlockDef } from './types.js' */

/** @type {Map<string, CoreBlockDef>} */
const registry = new Map(
  [
    textBlock,
    imageBlock,
    buttonBlock,
    dividerBlock,
    spacerBlock,
    imageTextBlock,
    socialBlock,
    htmlBlock,
  ].map((def) => [def.type, def]),
);

/** 標準ブロックの type 一覧（パレットの既定の並び順） */
export const BLOCK_TYPES = Object.freeze([...registry.keys()]);

/**
 * @param {string} type
 * @returns {CoreBlockDef | undefined}
 */
export function getBlockDef(type) {
  return registry.get(type);
}
