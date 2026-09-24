// エディタ内の小さな汎用関数

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
