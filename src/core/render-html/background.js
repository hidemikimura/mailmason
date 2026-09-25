// 背景画像（メール全体の外側・本文・行・カラム）の出力。
// - 一般のメールソフト: セルの background 属性と CSS の background-image など
// - Outlook（Windows）: 条件付きコメントの VML（v:rect + v:fill）。中身の高さに合わせて伸びる（mso-fit-shape-to-text）
//   VML の中に VML は置けないので、外側に背景画像がある要素の中では VML を出さない（Outlook では背景色になる）
// VML の値の対応は MJML の mj-section と同じ（cover = aspect atleast、contain = aspect atmost、
// 繰り返しあり = type tile、なし = type frame）
import { escapeAttr } from '../richtext/entities.js';

/** @import { BackgroundImage } from '../model/types.js' */
/** @import { Lines } from './lines.js' */

/**
 * CSS の url() に入れられるよう、引用符と括弧・空白をエスケープする
 * @param {string} url
 */
export const cssUrl = (url) =>
  url.replace(
    /[\\'"()\s]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
  );

/**
 * 背景画像があるか
 * @param {BackgroundImage | null | undefined} bg
 * @returns {bg is BackgroundImage}
 */
export const hasBackgroundImage = (bg) => Boolean(bg?.src);

/**
 * 背景画像の CSS 宣言（無ければ空の配列）
 * @param {BackgroundImage | null | undefined} bg
 * @returns {string[]}
 */
export function backgroundDecls(bg) {
  if (!hasBackgroundImage(bg)) return [];
  return [
    `background-image:url('${cssUrl(bg.src)}')`,
    `background-position:${bg.position}`,
    `background-size:${bg.size}`,
    `background-repeat:${bg.repeat}`,
  ];
}

/**
 * セルの background 属性（古いメールソフト向け。無ければ空文字）
 * @param {BackgroundImage | null | undefined} bg
 */
export function backgroundAttr(bg) {
  return hasBackgroundImage(bg) ? ` background="${escapeAttr(bg.src)}"` : '';
}

const AXIS = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };

/**
 * v:fill の属性
 * @param {BackgroundImage} bg
 * @param {string | null} color 背景色（画像が読めないときの色）
 */
function fillAttrs(bg, color) {
  const [x, y] = bg.position.split(' ').map((v) => AXIS[/** @type {keyof typeof AXIS} */ (v)]);
  const repeat = bg.repeat === 'repeat';
  /** @type {string} */
  let type = repeat ? 'tile' : 'frame';
  let origin;
  if (bg.size === 'auto') {
    // 原寸は tile で表示する（位置は上の中央）
    type = 'tile';
    origin = '0.5,0';
  } else {
    const shift = (/** @type {number} */ v) => String(repeat ? v : v - 0.5);
    origin = `${shift(x)},${shift(y)}`;
  }
  const size =
    bg.size === 'cover'
      ? ' size="1,1" aspect="atleast"'
      : bg.size === 'contain'
        ? ' size="1,1" aspect="atmost"'
        : '';
  return (
    ` type="${type}" src="${escapeAttr(bg.src)}"` +
    (color ? ` color="${color}"` : '') +
    ` origin="${origin}" position="${origin}"${size}`
  );
}

/**
 * 中身を VML の背景で包む（Outlook 用）。背景画像が無いとき、VML の中にあるときは中身をそのまま返す
 * @param {BackgroundImage | null | undefined} bg
 * @param {string | null} color
 * @param {number} width 背景を敷く幅（px）
 * @param {Lines} children
 * @param {{ insideVml?: boolean }} [options]
 * @returns {Lines}
 */
export function withVmlBackground(bg, color, width, children, options = {}) {
  if (!hasBackgroundImage(bg) || options.insideVml) return children;
  return [
    '<!--[if gte mso 9]>',
    `<v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:${width}px;">`,
    `<v:fill${fillAttrs(bg, color)} />`,
    '<v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">',
    '<![endif]-->',
    ...children,
    '<!--[if gte mso 9]>',
    '</v:textbox>',
    '</v:rect>',
    '<![endif]-->',
  ];
}

/**
 * メール全体の背景画像（Outlook 用の v:background。body の直後に置く）
 * @param {BackgroundImage | null | undefined} bg
 * @param {string} color
 * @returns {Lines}
 */
export function vmlPageBackground(bg, color) {
  if (!hasBackgroundImage(bg)) return [];
  return [
    '<!--[if gte mso 9]>',
    '<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">',
    `<v:fill${fillAttrs(bg, color)} />`,
    '</v:background>',
    '<![endif]-->',
  ];
}
