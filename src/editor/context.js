// ルートから子コンポーネントへ渡す共有コンテキスト

/** @import { Store } from '../core/store/store.js' */
/** @import { Translate } from './i18n.js' */
/** @import { ResolvedHtmlOptions } from '../core/blocks/types.js' */
/** @import { MergeTag, ImageSelectHook } from './fields/fields.js' */
/** @import { MergeTagDelimiters } from '../core/merge-tags.js' */

/**
 * @typedef {Object} EditorContext
 * @property {Store} store
 * @property {Translate} t
 * @property {string} locale
 * @property {ResolvedHtmlOptions} htmlOptions キャンバス表示に使う出力オプション
 * @property {MergeTag[]} mergeTags
 * @property {MergeTagDelimiters} delimiters
 * @property {ImageSelectHook | null} onImageSelect
 * @property {{ start(event: PointerEvent, payload: import('./dnd/target.js').DragPayload): void }} dnd
 *   ドラッグ&ドロップの開始（pointerdown で呼ぶ）
 * @property {(blockId: string | null) => void} edit テキストの直接編集を開始・終了する
 * @property {(change: { view?: 'edit' | 'preview', device?: 'desktop' | 'mobile' }) => void} setView
 *   編集 ⇄ プレビュー、PC ⇄ スマホを切り替える
 * @property {(name: 'palette' | 'settings') => void} toggleDrawer 狭い画面でパレット・設定パネルを開閉する
 */

/**
 * @param {string} name
 * @param {CustomElementConstructor} ctor
 */
export function define(name, ctor) {
  if (!customElements.get(name)) customElements.define(name, ctor);
}

export {};
