// 寛容な HTML パーサ（DOM 非依存）。
// 主な対象は正規化済みの整形式 HTML だが、外部から来た JSON や生 HTML でも壊れずに木を作る。
import { VOID_TAGS, element, text } from './ast.js';
import { decodeEntities } from './entities.js';

/** @import { ElementNode, RichNode } from './ast.js' */

/** 中身をテキストとして読み飛ばす要素 */
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title', 'xmp']);

/** 開くと、開いている p を暗黙に閉じる要素 */
const CLOSES_P = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'table',
  'blockquote',
  'pre',
  'section',
  'article',
  'header',
  'footer',
]);

const ATTR = /\s*([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;
const TAG_NAME = /[a-zA-Z][\w:-]*/y;

/**
 * @param {string} html
 * @returns {RichNode[]}
 */
export function parseHtml(html) {
  const root = element('#root');
  /** @type {ElementNode[]} */
  const stack = [root];
  const current = () => stack[stack.length - 1];

  /** @param {string} value */
  const appendText = (value) => {
    if (value === '') return;
    const parent = current();
    const last = parent.children[parent.children.length - 1];
    if (last?.type === 'text') last.value += value;
    else parent.children.push(text(value));
  };

  /** @param {string} tag */
  const closeTo = (tag) => {
    for (let i = stack.length - 1; i > 0; i--) {
      if (stack[i].tag === tag) {
        stack.length = i;
        return true;
      }
    }
    return false;
  };

  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      appendText(decodeEntities(html.slice(i)));
      break;
    }
    if (lt > i) appendText(decodeEntities(html.slice(i, lt)));
    i = lt;

    // コメント・条件付きコメント
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    // DOCTYPE・<![endif]> など
    if (html[i + 1] === '!' || html[i + 1] === '?') {
      const end = html.indexOf('>', i);
      i = end === -1 ? html.length : end + 1;
      continue;
    }

    // 終了タグ
    if (html[i + 1] === '/') {
      TAG_NAME.lastIndex = i + 2;
      const match = TAG_NAME.exec(html);
      if (!match) {
        appendText('<');
        i += 1;
        continue;
      }
      const end = html.indexOf('>', TAG_NAME.lastIndex);
      i = end === -1 ? html.length : end + 1;
      closeTo(match[0].toLowerCase());
      continue;
    }

    // 開始タグ
    TAG_NAME.lastIndex = i + 1;
    const nameMatch = TAG_NAME.exec(html);
    if (!nameMatch) {
      appendText('<');
      i += 1;
      continue;
    }
    const tag = nameMatch[0].toLowerCase();
    let pos = TAG_NAME.lastIndex;
    /** @type {Record<string, string>} */
    const attrs = {};
    let selfClosing = false;
    while (pos < html.length) {
      while (pos < html.length && /\s/.test(html[pos])) pos++;
      if (html[pos] === '>') {
        pos++;
        break;
      }
      if (html.startsWith('/>', pos)) {
        selfClosing = true;
        pos += 2;
        break;
      }
      ATTR.lastIndex = pos;
      const attr = ATTR.exec(html);
      if (!attr || attr[0].length === 0) {
        pos++;
        continue;
      }
      const name = attr[1].toLowerCase();
      if (name !== '/' && !Object.hasOwn(attrs, name)) {
        attrs[name] = decodeEntities(attr[2] ?? attr[3] ?? attr[4] ?? '');
      }
      pos = ATTR.lastIndex;
    }
    i = pos;

    if (CLOSES_P.has(tag) && current().tag === 'p') stack.pop();
    if (tag === 'li') {
      for (let s = stack.length - 1; s > 0; s--) {
        const open = stack[s].tag;
        if (open === 'ul' || open === 'ol') break;
        if (open === 'li') {
          stack.length = s;
          break;
        }
      }
    }

    const node = element(tag, attrs);
    current().children.push(node);

    if (RAW_TEXT_TAGS.has(tag)) {
      const close = html.toLowerCase().indexOf(`</${tag}`, i);
      const end = close === -1 ? html.length : close;
      if (end > i) node.children.push(text(html.slice(i, end)));
      const gt = close === -1 ? -1 : html.indexOf('>', close);
      i = gt === -1 ? html.length : gt + 1;
      continue;
    }
    if (!selfClosing && !VOID_TAGS.has(tag)) stack.push(node);
  }

  return root.children;
}
