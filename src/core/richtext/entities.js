// HTML 実体参照の復号（よく使うものだけ。未知の名前はそのまま残す）

/** @type {Record<string, string>} */
const NAMED = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '©',
  reg: '®',
  trade: '™',
  yen: '¥',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  times: '×',
  divide: '÷',
  middot: '·',
  bull: '•',
  zwnj: '‌',
  zwj: '‍',
  shy: '­',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
};

/**
 * @param {string} value
 * @returns {string}
 */
export function decodeEntities(value) {
  if (!value.includes('&')) return value;
  return value.replace(/&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, body) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return NAMED[body.toLowerCase()] ?? match;
  });
}

/**
 * テキストとして出力するときのエスケープ
 * @param {string} value
 * @returns {string}
 */
export function escapeText(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\u00a0/g, '&nbsp;');
}

/**
 * 属性値として出力するときのエスケープ（二重引用符で囲む前提）
 * @param {string} value
 * @returns {string}
 */
export function escapeAttr(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
