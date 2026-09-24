// AST → 正規形の HTML。属性は二重引用符、void 要素は `<br>` の形で出す
import { VOID_TAGS } from './ast.js';
import { escapeAttr, escapeText } from './entities.js';

/** @import { RichNode } from './ast.js' */

/**
 * @param {RichNode[]} nodes
 * @returns {string}
 */
export function serializeNodes(nodes) {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') {
      out += escapeText(node.value);
      continue;
    }
    let attrs = '';
    for (const [name, value] of Object.entries(node.attrs)) {
      attrs += ` ${name}="${escapeAttr(value)}"`;
    }
    out += `<${node.tag}${attrs}>`;
    if (VOID_TAGS.has(node.tag)) continue;
    out += `${serializeNodes(node.children)}</${node.tag}>`;
  }
  return out;
}
