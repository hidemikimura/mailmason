// 使うときだけ読み込む部品。npm 版（src をそのまま使う）と ESM 版（dist/mailmason.bundle.js）では別ファイルに分かれ、
// 最初に読み込む量を減らす（iife 版はすべて 1 ファイルに入る）。
// 部品のカスタム要素は、読み込む前に置いても定義されたときに中身が描かれる（Lit は定義前に入れたプロパティを引き継ぐ）
import { loadMessages } from './i18n.js';
import { importPreview, importQr, importTableEditor } from './chunks.js';

/**
 * 1 回だけ読み込む（失敗したら次に呼んだときにやり直す）
 * @template T
 * @param {() => Promise<T>} load
 * @returns {() => Promise<T>}
 */
function once(load) {
  /** @type {Promise<T> | null} */
  let promise = null;
  return () => {
    if (!promise) {
      promise = load().catch((error) => {
        promise = null;
        throw error;
      });
    }
    return promise;
  };
}

/** QR コードの PNG を作る（QR のライブラリを含む） */
export const loadQr = once(importQr);

/** プレビュー（<mm-preview>） */
export const loadPreview = once(importPreview);

/** 表の直接編集（<mm-table-editor>） */
export const loadTableEditor = once(importTableEditor);

/**
 * 読み込みに失敗したとき（ネットワークの切断など）はコンソールに出すだけにする
 * @param {() => Promise<unknown>} load
 */
export function preload(load) {
  load().catch((error) => console.error('[mailmason] 部品を読み込めませんでした', error));
}

/**
 * 後から読み込む部品をすべて読み込む（先読みやテストで使う）
 * @param {string} [locale] 英語の文言も読み込むとき 'en' など
 */
export async function loadAllEditorModules(locale = 'en') {
  await Promise.all([loadQr(), loadPreview(), loadTableEditor(), loadMessages(locale)]);
}
