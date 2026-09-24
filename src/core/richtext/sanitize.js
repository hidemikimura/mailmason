// リッチテキストを許可タグだけの正規形に整える。
// - トップレベルは段落（p / h1–h3）とリスト（ul / ol）だけにする
// - b → strong など同義タグの読み替え、div など → p、入れ子のブロックは兄弟の段落に平坦化
// - script などは中身ごと削除、それ以外の未許可タグは外して中身を残す
// - 属性・スタイルは許可したものだけ残す（href は http(s) / mailto / tel / # / マージタグのみ）
import { element, text } from './ast.js';
import {
  BLOCKISH_TAGS,
  BLOCK_TAGS,
  DROPPED_TAGS,
  INLINE_TAGS,
  LIST_TAGS,
  RENAMED_TAGS,
  TEXT_ALIGNS,
} from './allowlist.js';
import { parseHtml } from './parse.js';
import { serializeNodes } from './serialize.js';
import { DEFAULT_DELIMITERS } from '../merge-tags.js';

/** @import { ElementNode, RichNode } from './ast.js' */
/** @import { MergeTagDelimiters } from '../merge-tags.js' */

/**
 * @typedef {Object} SanitizeOptions
 * @property {MergeTagDelimiters} [delimiters] href にマージタグだけを書いたリンクを許可するため
 */

const BR = () => element('br');

/**
 * style 属性を { prop: value } にする
 * @param {string | undefined} style
 * @returns {Map<string, string>}
 */
function parseStyle(style) {
  const result = new Map();
  if (!style) return result;
  for (const decl of style.split(';')) {
    const colon = decl.indexOf(':');
    if (colon === -1) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const value = decl
      .slice(colon + 1)
      .replace(/!important/i, '')
      .trim();
    if (prop && value) result.set(prop, value);
  }
  return result;
}

/**
 * 色を `#rrggbb`（半透明なら rgba()）にそろえる。不正なら null
 * @param {string} value
 * @returns {string | null}
 */
export function normalizeCssColor(value) {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h = hex[1];
    return h.length === 3 ? `#${[...h].map((c) => c + c).join('')}` : `#${h}`;
  }
  const rgb =
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/.exec(v);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
    if ([r, g, b].some((n) => n > 255)) return null;
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
    if (alpha === 0) return null;
    if (alpha < 1) return `rgba(${r},${g},${b},${alpha})`;
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  }
  return null;
}

/**
 * @param {string} href
 * @param {MergeTagDelimiters} delimiters
 * @returns {string | null}
 */
function safeHref(href, delimiters) {
  const value = href.trim();
  if (/^(?:https?:|mailto:|tel:)/i.test(value)) return value;
  if (value.startsWith('#') && value.length > 1) return value;
  if (value.startsWith(delimiters.open)) return value;
  return null;
}

/**
 * ブロック要素の揃え（style の text-align または align 属性）
 * @param {ElementNode} node
 * @returns {string | null}
 */
function blockAlign(node) {
  const align = (
    parseStyle(node.attrs.style).get('text-align') ??
    node.attrs.align ??
    ''
  ).toLowerCase();
  return TEXT_ALIGNS.has(align) ? align : null;
}

/**
 * @param {string | null} align
 * @returns {Record<string, string>}
 */
function alignAttrs(align) {
  return align ? { style: `text-align:${align}` } : {};
}

/**
 * @param {string} tag 読み替え後のタグ
 * @param {ElementNode} node 元の要素
 * @param {MergeTagDelimiters} delimiters
 * @returns {Record<string, string>}
 */
function inlineAttrs(tag, node, delimiters) {
  if (tag === 'a') {
    const href = node.attrs.href === undefined ? null : safeHref(node.attrs.href, delimiters);
    if (!href) return {};
    return node.attrs.target === '_blank' ? { href, target: '_blank' } : { href };
  }
  if (tag === 'span') {
    const style = parseStyle(node.attrs.style);
    if (node.tag === 'font' && node.attrs.color) style.set('color', node.attrs.color);
    const decls = [];
    for (const prop of ['color', 'background-color']) {
      const raw = style.get(prop);
      const color = raw === undefined ? null : normalizeCssColor(raw);
      if (color) decls.push(`${prop}:${color}`);
    }
    return decls.length > 0 ? { style: decls.join(';') } : {};
  }
  return {};
}

/**
 * 隣り合うテキストをまとめ、空のテキストを除く
 * @param {RichNode[]} nodes
 * @returns {RichNode[]}
 */
function mergeTexts(nodes) {
  /** @type {RichNode[]} */
  const out = [];
  for (const node of nodes) {
    const last = out[out.length - 1];
    if (node.type === 'text') {
      if (node.value === '') continue;
      if (last?.type === 'text') last.value += node.value;
      else out.push(text(node.value));
    } else {
      out.push(node);
    }
  }
  return out;
}

/**
 * インライン内容を正規化する（ブロック要素が紛れていたら外して中身だけ残す）
 * @param {RichNode} node
 * @param {MergeTagDelimiters} delimiters
 * @returns {RichNode[]}
 */
function sanitizeInline(node, delimiters) {
  if (node.type === 'text') return [text(node.value)];
  const { tag } = node;
  if (DROPPED_TAGS.has(tag)) return [];
  if (tag === 'br') return [BR()];
  const children = mergeTexts(node.children.flatMap((child) => sanitizeInline(child, delimiters)));
  const mapped = RENAMED_TAGS[tag] ?? tag;
  if (!INLINE_TAGS.has(mapped)) return children;
  const attrs = inlineAttrs(mapped, node, delimiters);
  if ((mapped === 'a' && !attrs.href) || (mapped === 'span' && !attrs.style)) return children;
  if (children.length === 0) return [];
  return [element(mapped, attrs, children)];
}

/**
 * 空白をまとめる（改行やタブも 1 つの空白に）。NBSP は残す
 * @param {RichNode[]} nodes
 */
function collapseWhitespace(nodes) {
  for (const node of nodes) {
    if (node.type === 'text') node.value = node.value.replace(/[ \t\n\r\f]+/g, ' ');
    else collapseWhitespace(node.children);
  }
}

/**
 * 先頭（または末尾）の空白を削る。要素の中へ潜って最初（最後）のテキストを探す
 * @param {RichNode[]} nodes
 * @param {'start' | 'end'} side
 * @returns {boolean} テキストに行き当たったら true
 */
function trimEdge(nodes, side) {
  const order = side === 'start' ? nodes : [...nodes].reverse();
  for (const node of order) {
    if (node.type === 'text') {
      node.value = side === 'start' ? node.value.replace(/^ +/, '') : node.value.replace(/ +$/, '');
      if (node.value !== '') return true;
    } else if (node.tag === 'br') {
      return true;
    } else if (trimEdge(node.children, side)) {
      return true;
    }
  }
  return false;
}

/**
 * 空になった要素・テキストを取り除く
 * @param {RichNode[]} nodes
 * @returns {RichNode[]}
 */
function pruneEmpty(nodes) {
  /** @type {RichNode[]} */
  const out = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      if (node.value !== '') out.push(node);
    } else if (node.tag === 'br') {
      out.push(node);
    } else {
      node.children = pruneEmpty(node.children);
      if (node.children.length > 0) out.push(node);
    }
  }
  return mergeTexts(out);
}

/**
 * 1 段落分のインライン内容を仕上げる: 空白の整理、端の空白・末尾の <br> の除去
 * @param {RichNode[]} run
 * @returns {RichNode[]} 内容が無ければ空配列
 */
function finishInline(run) {
  let nodes = mergeTexts(run);
  collapseWhitespace(nodes);
  // <br> の前後の空白を削る
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'element' && node.tag === 'br') {
      trimEdge(nodes.slice(0, i), 'end');
      trimEdge(nodes.slice(i + 1), 'start');
    }
  }
  trimEdge(nodes, 'start');
  trimEdge(nodes, 'end');
  nodes = pruneEmpty(nodes);

  const isBr = (/** @type {RichNode | undefined} */ n) => n?.type === 'element' && n.tag === 'br';
  const hasText = nodes.some((n) => !isBr(n));
  if (!hasText) return nodes.length > 0 ? [BR()] : []; // 空行（<p><br></p>）は 1 つの <br> として残す
  while (isBr(nodes[nodes.length - 1])) nodes.pop();
  return nodes;
}

/**
 * @param {ElementNode} li
 * @param {MergeTagDelimiters} delimiters
 * @returns {ElementNode | null}
 */
function sanitizeListItem(li, delimiters) {
  /** @type {RichNode[]} */
  const out = [];
  /** @type {RichNode[]} */
  let run = [];
  const flush = () => {
    out.push(...finishInline(run));
    run = [];
  };
  for (const child of li.children) {
    if (child.type === 'element' && LIST_TAGS.has(child.tag)) {
      flush();
      const list = sanitizeList(child, delimiters);
      if (list) out.push(list);
    } else if (
      child.type === 'element' &&
      (BLOCK_TAGS.has(child.tag) || BLOCKISH_TAGS.has(child.tag))
    ) {
      // li の中の段落は、改行で区切ったインライン内容にする
      if (run.length > 0) run.push(BR());
      run.push(...child.children.flatMap((c) => sanitizeInline(c, delimiters)));
    } else {
      run.push(...sanitizeInline(child, delimiters));
    }
  }
  flush();
  if (out.length === 0) return null;
  return element('li', alignAttrs(blockAlign(li)), out);
}

/**
 * @param {ElementNode} list
 * @param {MergeTagDelimiters} delimiters
 * @returns {ElementNode | null}
 */
function sanitizeList(list, delimiters) {
  /** @type {ElementNode[]} */
  const items = [];
  for (const child of list.children) {
    if (child.type === 'text') {
      if (child.value.trim() === '') continue;
      const item = sanitizeListItem(element('li', {}, [child]), delimiters);
      if (item) items.push(item);
    } else if (child.tag === 'li') {
      const item = sanitizeListItem(child, delimiters);
      if (item) items.push(item);
    } else if (LIST_TAGS.has(child.tag)) {
      // リスト直下のリスト（execCommand が作りがち）は直前の項目の子にする
      const nested = sanitizeList(child, delimiters);
      if (!nested) continue;
      const prev = items[items.length - 1];
      if (prev) prev.children.push(nested);
      else items.push(element('li', {}, [nested]));
    } else if (!DROPPED_TAGS.has(child.tag)) {
      const item = sanitizeListItem(element('li', {}, [child]), delimiters);
      if (item) items.push(item);
    }
  }
  return items.length > 0 ? element(list.tag, {}, items) : null;
}

/**
 * ノード列をトップレベルの段落・リストの並びにする
 * @param {RichNode[]} nodes
 * @param {string} wrapTag インライン内容を包む段落のタグ
 * @param {string | null} align 継承する揃え
 * @param {MergeTagDelimiters} delimiters
 * @returns {ElementNode[]}
 */
function toBlocks(nodes, wrapTag, align, delimiters) {
  /** @type {ElementNode[]} */
  const out = [];
  /** @type {RichNode[]} */
  let run = [];
  const flush = () => {
    const inline = finishInline(run);
    if (inline.length > 0) out.push(element(wrapTag, alignAttrs(align), inline));
    run = [];
  };

  for (const node of nodes) {
    if (node.type === 'text') {
      run.push(text(node.value));
      continue;
    }
    const { tag } = node;
    if (DROPPED_TAGS.has(tag)) continue;
    if (LIST_TAGS.has(tag)) {
      flush();
      const list = sanitizeList(node, delimiters);
      if (list) out.push(list);
    } else if (BLOCK_TAGS.has(tag) || BLOCKISH_TAGS.has(tag) || tag === 'li') {
      flush();
      const mapped = BLOCK_TAGS.has(tag) ? tag : /^h[4-6]$/.test(tag) ? 'h3' : 'p';
      out.push(...toBlocks(node.children, mapped, blockAlign(node) ?? align, delimiters));
    } else {
      run.push(...sanitizeInline(node, delimiters));
    }
  }
  flush();
  return out;
}

/**
 * AST を正規化する
 * @param {RichNode[]} nodes
 * @param {SanitizeOptions} [options]
 * @returns {ElementNode[]}
 */
export function sanitizeNodes(nodes, options = {}) {
  return toBlocks(nodes, 'p', null, options.delimiters ?? DEFAULT_DELIMITERS);
}

/**
 * HTML 文字列を正規形に整える。整形済みの入力はそのまま返る（冪等）
 * @param {string} html
 * @param {SanitizeOptions} [options]
 * @returns {string}
 */
export function sanitizeHtml(html, options = {}) {
  if (html === '') return '';
  return serializeNodes(sanitizeNodes(parseHtml(html), options));
}
