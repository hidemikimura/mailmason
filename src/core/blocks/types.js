/** @import { Schema } from '../model/schema.js' */
/** @import { Block, BodySettings } from '../model/types.js' */
/** @import { Lines } from '../render-html/lines.js' */
/** @import { MergeTagDelimiters } from '../merge-tags.js' */

/**
 * @typedef {Object} ResolvedHtmlOptions
 * @property {boolean} minify
 * @property {Record<string, string> | null} mergeValues
 * @property {MergeTagDelimiters} mergeTagDelimiters
 * @property {string} socialIconBaseUrl 末尾の / を除いた URL（空なら SNS はテキストリンク）
 * @property {string} locale
 * @property {string} lang
 * @property {string} outlookFontFamily
 */

/**
 * @typedef {Object} HtmlContext
 * @property {number} width ブロックの内容幅（px、ブロックの余白を除く）
 * @property {BodySettings} body
 * @property {ResolvedHtmlOptions} options
 */

/**
 * @typedef {Object} ResolvedTextOptions
 * @property {number} wrapWidth
 * @property {'\n' | '\r\n'} newline
 * @property {string} headingPrefix
 * @property {string} dividerText
 * @property {string} locale
 * @property {Record<string, string> | null} mergeValues
 * @property {MergeTagDelimiters} mergeTagDelimiters
 */

/**
 * @typedef {Object} TextContext
 * @property {ResolvedTextOptions} options
 */

/**
 * コア側のブロック定義
 * @typedef {Object} CoreBlockDef
 * @property {string} type
 * @property {() => Record<string, unknown>} defaults 新規作成時の values
 * @property {Schema} schema values の正規化スキーマ
 * @property {() => Block['style']} [defaultStyle] 共通スタイルの既定値（省略時は余白 10px）
 * @property {string[]} mergeTagFields マージタグを検査する values のキー（ドット区切りのパス可）
 * @property {(values: any, options: { delimiters: MergeTagDelimiters }) => any} [sanitize]
 *   読込時の追加整形（リッチテキストの許可タグ正規化など）
 * @property {(block: Block) => 'left' | 'center' | 'right'} [cellAlign] ブロックを包むセルの揃え
 * @property {(block: Block, ctx: HtmlContext) => Lines} renderHtml 中身の HTML（空配列なら出力しない）
 * @property {(block: Block, ctx: TextContext) => string} renderText テキストパート（空文字なら出力しない）
 */

export {};
