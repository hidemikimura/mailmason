// 正規化済みリッチテキスト → プレーンテキスト
import { parseHtml } from './parse.js';

/** @import { ElementNode, RichNode } from './ast.js' */

/**
 * @typedef {Object} RichTextToPlainOptions
 * @property {string} [headingPrefix] 見出しの前に付ける記号（既定なし）
 */

/**
 * リンクのテキスト表現: `テキスト ( URL )`。テキストと URL が同じなら URL だけ
 * @param {string} label
 * @param {string | undefined} href
 * @returns {string}
 */
export function linkToText(label, href) {
  const text = label.trim();
  if (!href) return text;
  const bare = href.replace(/^(?:mailto|tel):/i, '');
  if (text === '' || text === href || text === bare) return bare;
  return `${text} ( ${bare} )`;
}

/**
 * @param {RichNode[]} nodes
 * @returns {string}
 */
function inline(nodes) {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') {
      out += node.value.replace(/[ \t\r\n]+/g, ' ').replace(/\u00a0/g, ' ');
    } else if (node.tag === 'br') {
      out += '\n';
    } else if (node.tag === 'a') {
      out += linkToText(inline(node.children), node.attrs.href);
    } else if (node.tag === 'ul' || node.tag === 'ol') {
      out += `\n${listLines(node, 1).join('\n')}`;
    } else {
      out += inline(node.children);
    }
  }
  return out;
}

/**
 * @param {string} value
 */
function tidy(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * @param {ElementNode} node
 * @param {number} depth
 * @returns {string[]}
 */
function listLines(node, depth) {
  const indent = '  '.repeat(depth);
  const lines = [];
  let n = 0;
  for (const item of node.children) {
    if (item.type !== 'element') continue;
    n += 1;
    const marker = node.tag === 'ol' ? `${n}. ` : '・';
    const content = item.children.filter((c) => !(c.type === 'element' && /^[uo]l$/.test(c.tag)));
    const nested = item.children.filter(
      /** @returns {c is ElementNode} */ (c) => c.type === 'element' && /^[uo]l$/.test(c.tag),
    );
    const [first = '', ...rest] = tidy(inline(content)).split('\n');
    lines.push(indent + marker + first);
    const pad = indent + ' '.repeat(marker === '・' ? 2 : marker.length);
    for (const line of rest) lines.push(pad + line);
    for (const list of nested) lines.push(...listLines(list, depth + 1));
  }
  return lines;
}

/**
 * @param {string} html 正規化済みのリッチテキスト
 * @param {RichTextToPlainOptions} [options]
 * @returns {string} 段落は空行で区切る
 */
export function richTextToPlain(html, options = {}) {
  const { headingPrefix = '' } = options;
  const paragraphs = [];
  for (const node of parseHtml(html)) {
    if (node.type === 'text') {
      const value = tidy(inline([node]));
      if (value) paragraphs.push(value);
      continue;
    }
    if (node.tag === 'ul' || node.tag === 'ol') {
      paragraphs.push(listLines(node, 0).join('\n'));
    } else if (/^h[1-3]$/.test(node.tag)) {
      paragraphs.push(headingPrefix + tidy(inline(node.children)));
    } else {
      paragraphs.push(tidy(inline(node.children)));
    }
  }
  return paragraphs.filter((p) => p !== '').join('\n\n');
}
