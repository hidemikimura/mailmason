// テンプレート JSON の型定義（JSDoc）。実行時のコードは持たない。
// 詳細は設計ドキュメント「データモデル」を参照。

/**
 * @typedef {'1' | '1:1' | '1:1:1' | '1:2' | '2:1' | '1:1:1:1'} RowLayout
 */

/**
 * @typedef {Object} Spacing
 * @property {number} top
 * @property {number} right
 * @property {number} bottom
 * @property {number} left
 */

/**
 * 背景画像（src が空なら背景画像なし）
 * @typedef {Object} BackgroundImage
 * @property {string} src
 * @property {'cover' | 'contain' | 'auto'} size
 * @property {'left top' | 'center top' | 'right top' | 'left center' | 'center center' | 'right center' | 'left bottom' | 'center bottom' | 'right bottom'} position
 * @property {'no-repeat' | 'repeat'} repeat
 * @property {Record<string, unknown> | null} uploadData
 */

/**
 * @typedef {Object} BodySettings
 * @property {number} width 本文の幅（px）
 * @property {string} backgroundColor 外側の背景色
 * @property {BackgroundImage} backgroundImage 外側の背景画像
 * @property {string} contentBackgroundColor 本文の背景色
 * @property {BackgroundImage} contentBackgroundImage 本文の背景画像
 * @property {string} fontFamily
 * @property {number} fontSize 基本文字サイズ（px）
 * @property {number} lineHeight 行の高さ（倍率）
 * @property {string} textColor
 * @property {string} linkColor
 * @property {string} preheader プリヘッダーテキスト
 * @property {string} title HTML の title
 */

/**
 * @typedef {Object} Block
 * @property {string} id
 * @property {string} type
 * @property {Record<string, unknown>} values
 * @property {{ backgroundColor: string | null, padding: Spacing }} style
 * @property {'mobile' | null} hideOn
 */

/**
 * @typedef {Object} Column
 * @property {string} id
 * @property {{ backgroundColor: string | null, backgroundImage: BackgroundImage, padding: Spacing, verticalAlign: 'top' | 'middle' | 'bottom' }} settings
 * @property {Block[]} blocks
 */

/**
 * @typedef {Object} RowSettings
 * @property {string | null} backgroundColor
 * @property {BackgroundImage} backgroundImage
 * @property {Spacing} padding
 * @property {number} columnGap
 * @property {boolean} stackOnMobile
 * @property {'mobile' | null} hideOn
 */

/**
 * @typedef {Object} Row
 * @property {string} id
 * @property {RowLayout} layout
 * @property {RowSettings} settings
 * @property {Column[]} columns
 */

/**
 * @typedef {Object} Body
 * @property {BodySettings} settings
 * @property {Row[]} rows
 */

/**
 * @typedef {Object} TextPart
 * @property {'auto' | 'manual'} mode
 * @property {string | null} content 手編集したテキスト（manual のとき）
 * @property {string | null} sourceHash 手編集を始めた時点の自動生成テキストのハッシュ
 */

/**
 * @typedef {Object} Template
 * @property {1} version
 * @property {Body} body
 * @property {TextPart} text
 */

export {};
