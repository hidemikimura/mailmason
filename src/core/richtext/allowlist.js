// テキストブロックで許可する HTML の定義

/** 段落として扱うブロック要素（出力タグ） */
export const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3']);

/** 段落に変換するブロック的な要素 */
export const BLOCKISH_TAGS = new Set([
  'div',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'aside',
  'nav',
  'center',
  'blockquote',
  'pre',
  'address',
  'figure',
  'figcaption',
  'form',
  'fieldset',
  'table',
  'tbody',
  'thead',
  'tfoot',
  'tr',
  'td',
  'th',
  'caption',
  'dl',
  'dt',
  'dd',
  'details',
  'summary',
  'body',
  'html',
  'h4',
  'h5',
  'h6',
]);

export const LIST_TAGS = new Set(['ul', 'ol']);

/** 許可するインライン要素 */
export const INLINE_TAGS = new Set(['strong', 'em', 'u', 's', 'a', 'span']);

/** 同じ意味の許可タグへ読み替える */
/** @type {Record<string, string>} */
export const RENAMED_TAGS = {
  b: 'strong',
  i: 'em',
  strike: 's',
  del: 's',
  ins: 'u',
  font: 'span',
};

/** 中身ごと削除する要素 */
export const DROPPED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'template',
  'head',
  'title',
  'noscript',
  'svg',
  'math',
  'canvas',
  'video',
  'audio',
  'select',
  'textarea',
  'input',
  'button',
  'img',
  'hr',
  'meta',
  'link',
]);

export const TEXT_ALIGNS = new Set(['left', 'center', 'right', 'justify']);
