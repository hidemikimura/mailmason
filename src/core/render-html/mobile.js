// スマホだけの文字サイズ。要素にクラスを付け、メディアクエリの中に規則を出す（出力 1 回ごとに集める）。
// インラインの font-size と px の line-height を !important で上書きする。
// Outlook（Windows）とメディアクエリに対応しないメールソフトでは PC と同じ大きさのまま

/**
 * @typedef {Object} MobileStyles
 * @property {(size: number, lineHeight: number) => string} font 文字サイズ（px）と行の高さ（倍率）のクラス名
 * @property {() => string[]} rules メディアクエリに入れる規則
 */

/** @returns {MobileStyles} */
export function createMobileStyles() {
  /** @type {Map<string, string>} */
  const rules = new Map();
  return {
    font(size, lineHeight) {
      const px = Math.round(size * lineHeight);
      const name = `mm-f${String(size).replace('.', '_')}-${px}`;
      if (!rules.has(name)) {
        rules.set(name, `.${name}{font-size:${size}px !important;line-height:${px}px !important;}`);
      }
      return name;
    },
    rules: () => [...rules.values()],
  };
}

/**
 * スマホでの文字サイズ。ブロックの指定があればそれ、無ければ文字サイズを指定していない（本文と同じ）
 * ブロックだけメール全体のスマホの文字サイズに従う。PC と同じなら null
 * @param {{ fontSize: number, mobileFontSize?: number | null }} body
 * @param {number | null | undefined} fontSize ブロックの文字サイズ（null なら本文と同じ）
 * @param {number | null | undefined} [mobileFontSize] ブロックのスマホの文字サイズ
 * @returns {number | null}
 */
export function resolveMobileFontSize(body, fontSize, mobileFontSize) {
  const pc = typeof fontSize === 'number' ? fontSize : body.fontSize;
  const mobile =
    typeof mobileFontSize === 'number'
      ? mobileFontSize
      : typeof fontSize === 'number'
        ? null
        : (body.mobileFontSize ?? null);
  return mobile !== null && mobile !== pc ? mobile : null;
}

/**
 * class 属性（空なら何も出さない）
 * @param {...(string | null | false | undefined)} names
 */
export function classAttr(...names) {
  const list = names.filter(Boolean);
  return list.length > 0 ? ` class="${list.join(' ')}"` : '';
}

/**
 * ブロックの要素に付ける、スマホの文字サイズのクラス（PC と同じなら null）
 * @param {import('../blocks/types.js').HtmlContext} ctx
 * @param {number | null | undefined} fontSize ブロックの文字サイズ（null なら本文と同じ）
 * @param {number | null | undefined} mobileFontSize ブロックのスマホの文字サイズ
 * @param {number} lineHeight 行の高さ（倍率）
 * @returns {string | null}
 */
export function mobileFontClass(ctx, fontSize, mobileFontSize, lineHeight) {
  const size = resolveMobileFontSize(ctx.body, fontSize, mobileFontSize);
  return size === null ? null : ctx.options.mobileStyles.font(size, lineHeight);
}
