// エディタ内の小さな汎用関数
import { cssUrl } from '../core/render-html/background.js';

/**
 * ドット区切りのパスで値を取り出す
 * @param {unknown} source
 * @param {string} path
 * @returns {any}
 */
export function getIn(source, path) {
  let current = /** @type {any} */ (source);
  for (const key of path.split('.')) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * パスに値を入れた複製を返す（数字の部分は配列の添字として扱う）
 * @param {unknown} target
 * @param {string} path ドット区切り（例: 'items.0.image.src'）
 * @param {unknown} value
 * @returns {any}
 */
export function setIn(target, path, value) {
  /** @param {unknown} node @param {string[]} keys @returns {unknown} */
  const walk = (node, keys) => {
    if (keys.length === 0) return value;
    const [head, ...rest] = keys;
    if (Array.isArray(node)) {
      const next = node.slice();
      next[Number(head)] = walk(next[Number(head)], rest);
      return next;
    }
    const obj = /** @type {Record<string, unknown>} */ (
      node && typeof node === 'object' ? node : {}
    );
    return { ...obj, [head]: walk(obj[head], rest) };
  };
  return walk(target, path.split('.'));
}

/**
 * ドット区切りのパスから入れ子のパッチを作る: ('image.src', 'a') → { image: { src: 'a' } }
 * @param {string} path
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
export function patchAt(path, value) {
  const keys = path.split('.');
  /** @type {Record<string, unknown>} */
  const root = {};
  let current = root;
  keys.forEach((key, i) => {
    if (i === keys.length - 1) current[key] = value;
    else current = /** @type {Record<string, unknown>} */ (current[key] = {});
  });
  return root;
}

/**
 * 画像の実寸を読む（読めなければ null）
 * @param {string} src
 * @returns {Promise<{ width: number, height: number } | null>}
 */
export function measureImage(src) {
  return new Promise((resolve) => {
    if (!src || typeof Image === 'undefined') return resolve(null);
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * 差し込み変数の候補から、キー → 値の表を作る
 * @param {import('./fields/fields.js').MergeTag[]} mergeTags
 * @param {'sample' | 'fallback'} use sample: プレビュー用（sample → fallback の順）、fallback: 配信用の既定値だけ
 * @returns {Record<string, string>}
 */
export function mergeTagValues(mergeTags, use) {
  /** @type {Record<string, string>} */
  const values = {};
  for (const tag of mergeTags) {
    const value = use === 'sample' ? (tag.sample ?? tag.fallback) : tag.fallback;
    if (value != null) values[tag.key] = value;
  }
  return values;
}

/**
 * 日本語入力（IME）の変換中のキー操作か。変換を確定する Enter などをショートカットとして扱わないために使う。
 * Safari は確定の Enter を compositionend の後に isComposing: false で送るが、keyCode は 229 になる
 * @param {KeyboardEvent} event
 */
export function isComposing(event) {
  return event.isComposing || event.keyCode === 229;
}

/**
 * 背景画像の CSS（styleMap 用。画像が無ければ空）
 * @param {import('../core/model/types.js').BackgroundImage | null | undefined} bg
 * @returns {Record<string, string>}
 */
export function backgroundStyles(bg) {
  if (!bg?.src) return {};
  return {
    'background-image': `url('${cssUrl(bg.src)}')`,
    'background-position': bg.position,
    'background-size': bg.size,
    'background-repeat': bg.repeat,
  };
}
