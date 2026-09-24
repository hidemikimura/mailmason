// テンプレート操作で使う小さな汎用関数（依存なし）

/**
 * プレーンオブジェクトかどうか（配列・null・クラスインスタンスを除く）
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * JSON で表せる値か（null・真偽値・文字列・有限の数値・配列・プレーンオブジェクトだけでできている）
 * @param {unknown} value
 * @param {number} [depth] 入れ子の深さ（循環参照やごく深い値を弾く）
 * @returns {boolean}
 */
export function isJsonValue(value, depth = 0) {
  if (depth > 32) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
  if (isPlainObject(value)) {
    return Object.values(value).every((item) => isJsonValue(item, depth + 1));
  }
  return false;
}

/**
 * JSON 相当の値を深く比較する
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function isEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => isEqual(item, b[i]));
  }
  if (isPlainObject(a)) {
    if (!isPlainObject(b)) return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => Object.hasOwn(b, key) && isEqual(a[key], b[key]));
  }
  return false;
}

/**
 * patch を base に深くマージした新しいオブジェクトを返す。
 * プレーンオブジェクト同士は再帰的にマージし、配列やその他の値は置き換える。
 * patch の値が undefined のキーは無視する。
 * @template {Record<string, unknown>} T
 * @param {T} base
 * @param {Record<string, unknown>} patch
 * @returns {T}
 */
export function deepMerge(base, patch) {
  /** @type {Record<string, unknown>} */
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = result[key];
    result[key] =
      isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return /** @type {T} */ (result);
}
