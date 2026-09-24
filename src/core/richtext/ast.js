// リッチテキストの AST。パーサ・正規化器・シリアライザ・テキスト変換で共有する

/**
 * @typedef {{ type: 'text', value: string }} TextNode
 * @typedef {{ type: 'element', tag: string, attrs: Record<string, string>, children: RichNode[] }} ElementNode
 * @typedef {TextNode | ElementNode} RichNode
 */

/**
 * @param {string} value
 * @returns {TextNode}
 */
export function text(value) {
  return { type: 'text', value };
}

/**
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @param {RichNode[]} [children]
 * @returns {ElementNode}
 */
export function element(tag, attrs = {}, children = []) {
  return { type: 'element', tag, attrs, children };
}

/** 子を持たない要素 */
export const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
