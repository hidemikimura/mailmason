// 正規化済みリッチテキストをメール用 HTML にする。
// Outlook は親からの継承が不安定なので、段落・見出し・リスト項目のそれぞれに文字設定を付ける。
import { parseHtml } from '../richtext/parse.js';
import { escapeAttr, escapeText } from '../richtext/entities.js';
import { fontDecls, styleAttr } from './styles.js';
import { classAttr } from './mobile.js';

/** @import { ElementNode, RichNode } from '../richtext/ast.js' */
/** @import { TextStyle } from './styles.js' */

/** 見出しの文字サイズ（本文比） */
const HEADING_SCALE = { h1: 1.75, h2: 1.4, h3: 1.2 };

/**
 * @typedef {Object} RichTextContext
 * @property {TextStyle} style
 * @property {string} linkColor
 * @property {{ fontSize: number, styles: import('./mobile.js').MobileStyles } | null} [mobile] スマホの文字サイズ（PC と同じなら無し）
 */

/**
 * スマホの文字サイズのクラス（見出しは本文に対する倍率を掛ける）
 * @param {RichTextContext} ctx
 * @param {number} lineHeight
 * @param {number} [scale]
 */
function mobileClass(ctx, lineHeight, scale = 1) {
  if (!ctx.mobile) return '';
  const size = scale === 1 ? ctx.mobile.fontSize : Math.round(ctx.mobile.fontSize * scale);
  return classAttr(ctx.mobile.styles.font(size, lineHeight));
}

/**
 * @param {number} px
 * @returns {string}
 */
function marginBottom(px) {
  return px === 0 ? 'margin:0' : `margin:0 0 ${px}px`;
}

/**
 * @param {ElementNode} node
 * @returns {string | null}
 */
function alignOf(node) {
  const match = /text-align:(left|center|right|justify)/.exec(node.attrs.style ?? '');
  return match ? `text-align:${match[1]}` : null;
}

/**
 * @param {RichNode[]} nodes
 * @param {RichTextContext} ctx
 * @returns {string}
 */
function inline(nodes, ctx) {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') {
      out += escapeText(node.value);
      continue;
    }
    const children = () => inline(node.children, ctx);
    switch (node.tag) {
      case 'br':
        out += '<br />';
        break;
      case 'a': {
        const href = node.attrs.href ? ` href="${escapeAttr(node.attrs.href)}"` : '';
        out += `<a${href} target="_blank"${styleAttr(`color:${ctx.linkColor}`, 'text-decoration:underline')}>${children()}</a>`;
        break;
      }
      case 'span':
        out += `<span${styleAttr(node.attrs.style)}>${children()}</span>`;
        break;
      case 'strong':
      case 'em':
      case 'u':
      case 's':
        out += `<${node.tag}>${children()}</${node.tag}>`;
        break;
      case 'ul':
      case 'ol':
        out += list(node, ctx, true);
        break;
      default:
        out += children();
    }
  }
  return out;
}

/**
 * @param {ElementNode} node
 * @param {RichTextContext} ctx
 * @param {boolean} nested
 * @param {boolean} [last]
 * @returns {string}
 */
function list(node, ctx, nested, last = false) {
  const { style } = ctx;
  const gap = Math.round(style.fontSize * 0.25);
  const margin = nested ? `margin:${gap}px 0 0` : marginBottom(last ? 0 : style.fontSize);
  const items = node.children
    .filter((child) => child.type === 'element')
    .map((item, i, all) => {
      const itemMargin = marginBottom(i === all.length - 1 ? 0 : gap);
      return `<li${mobileClass(ctx, style.lineHeight)}${styleAttr(itemMargin, ...fontDecls(style), alignOf(item))}>${inline(item.children, ctx)}</li>`;
    })
    .join('');
  return `<${node.tag}${mobileClass(ctx, style.lineHeight)}${styleAttr(margin, `padding:0 0 0 ${Math.round(style.fontSize * 1.5)}px`, ...fontDecls(style))}>${items}</${node.tag}>`;
}

/**
 * @param {string} html 正規化済みのリッチテキスト
 * @param {RichTextContext} ctx
 * @returns {string[]} トップレベルのブロックごとの HTML
 */
export function renderRichText(html, ctx) {
  const { style } = ctx;
  const blocks = parseHtml(html).filter(
    /** @returns {node is ElementNode} */ (node) => node.type === 'element',
  );
  return blocks.map((node, i) => {
    const last = i === blocks.length - 1;
    switch (node.tag) {
      case 'h1':
      case 'h2':
      case 'h3': {
        const size = Math.round(style.fontSize * HEADING_SCALE[node.tag]);
        const heading = { ...style, lineHeight: Math.min(style.lineHeight, 1.4) };
        const margin = marginBottom(last ? 0 : Math.round(size * 0.5));
        const mobile = mobileClass(ctx, heading.lineHeight, HEADING_SCALE[node.tag]);
        return `<${node.tag}${mobile}${styleAttr(margin, ...fontDecls(heading, size), 'font-weight:bold', alignOf(node))}>${inline(node.children, ctx)}</${node.tag}>`;
      }
      case 'ul':
      case 'ol':
        return list(node, ctx, false, last);
      default: {
        const margin = marginBottom(last ? 0 : style.fontSize);
        return `<p${mobileClass(ctx, style.lineHeight)}${styleAttr(margin, ...fontDecls(style), alignOf(node))}>${inline(node.children, ctx)}</p>`;
      }
    }
  });
}

/**
 * 段落を持たないリッチテキスト（表のセルなど。sanitizeInlineHtml の出力）をメール用 HTML にする
 * @param {string} html
 * @param {{ linkColor: string }} ctx
 * @returns {string}
 */
export function renderInlineRichText(html, ctx) {
  return inline(
    parseHtml(html),
    /** @type {RichTextContext} */ ({ ...ctx, style: /** @type {any} */ (null) }),
  );
}
