// 値の正規化スキーマ。読込時の検証と、コマンドで更新した値の整形の両方に使う。
//
// 規則:
// - 入力が undefined なら既定値を返す（警告なし）
// - 型や範囲が不正なら既定値に置き換えて `invalid-value` を警告
// - object の未知キーは削除して `unknown-key` を警告

import { isJsonValue, isPlainObject } from './utils.js';

/**
 * @typedef {Object} Warning
 * @property {string} code 例: 'invalid-value', 'unknown-key'
 * @property {string} path 例: 'body.rows[0].settings.padding'
 * @property {string} message
 */

/**
 * @typedef {Object} NormalizeContext
 * @property {string} path
 * @property {Warning[]} warnings
 */

/**
 * スキーマの中身（ドキュメントの自動生成用。正規化には使わない）
 * @typedef {Object} SchemaInfo
 * @property {'any' | 'string' | 'number' | 'boolean' | 'color' | 'oneOf' | 'spacing' | 'object' | 'array' | 'record'} type
 * @property {boolean} [nullable]
 * @property {number} [min]
 * @property {number} [max]
 * @property {boolean} [integer]
 * @property {readonly (string | null)[]} [values] oneOf の候補
 * @property {Record<string, Schema>} [shape] object の項目
 * @property {Schema} [item] array の要素
 * @property {() => unknown} [itemDefault] array の要素の既定値
 */

/**
 * @typedef {Object} Schema
 * @property {(input: unknown, fallback: any, ctx: NormalizeContext) => any} normalize
 * @property {SchemaInfo} [info]
 */

/**
 * @param {NormalizeContext} ctx
 * @param {string} key
 * @returns {NormalizeContext}
 */
export function child(ctx, key) {
  const path = /^\[/.test(key) ? `${ctx.path}${key}` : ctx.path ? `${ctx.path}.${key}` : key;
  return { path, warnings: ctx.warnings };
}

/**
 * @param {NormalizeContext} ctx
 * @param {string} code
 * @param {string} message
 */
export function warn(ctx, code, message) {
  ctx.warnings.push({ code, path: ctx.path, message });
}

/**
 * @param {unknown} value
 * @returns {any}
 */
function clone(value) {
  return value !== null && typeof value === 'object' ? structuredClone(value) : value;
}

/**
 * @param {NormalizeContext} ctx
 * @param {unknown} input
 * @param {unknown} fallback
 */
function invalid(ctx, input, fallback) {
  let shown;
  try {
    shown = JSON.stringify(input);
  } catch {
    shown = Object.prototype.toString.call(input); // 循環参照など
  }
  warn(ctx, 'invalid-value', `Invalid value ${shown}; replaced with the default.`);
  return clone(fallback);
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * `#abc` を `#aabbcc` にし、小文字にそろえる
 * @param {string} value
 */
function normalizeHex(value) {
  const hex = value.slice(1).toLowerCase();
  return hex.length === 3 ? `#${[...hex].map((c) => c + c).join('')}` : `#${hex}`;
}

export const s = {
  /**
   * 任意の値（検証しない）
   * @returns {Schema}
   */
  any() {
    return {
      info: { type: 'any' },
      normalize: (input, fallback) => (input === undefined ? clone(fallback) : input),
    };
  },

  /**
   * @param {{ nullable?: boolean }} [options]
   * @returns {Schema}
   */
  string({ nullable = false } = {}) {
    return {
      info: { type: 'string', nullable },
      normalize(input, fallback, ctx) {
        if (input === undefined) return fallback;
        if (input === null && nullable) return null;
        return typeof input === 'string' ? input : invalid(ctx, input, fallback);
      },
    };
  },

  /**
   * @param {{ min?: number, max?: number, integer?: boolean, nullable?: boolean }} [options]
   * @returns {Schema}
   */
  number({ min = -Infinity, max = Infinity, integer = false, nullable = false } = {}) {
    return {
      info: { type: 'number', min, max, integer, nullable },
      normalize(input, fallback, ctx) {
        if (input === undefined) return fallback;
        if (input === null && nullable) return null;
        if (typeof input !== 'number' || !Number.isFinite(input))
          return invalid(ctx, input, fallback);
        if (integer && !Number.isInteger(input)) return invalid(ctx, input, fallback);
        if (input < min || input > max) return invalid(ctx, input, fallback);
        return input;
      },
    };
  },

  /** @returns {Schema} */
  boolean() {
    return {
      info: { type: 'boolean' },
      normalize(input, fallback, ctx) {
        if (input === undefined) return fallback;
        return typeof input === 'boolean' ? input : invalid(ctx, input, fallback);
      },
    };
  },

  /**
   * `#rrggbb`（`#rgb` は展開する）
   * @param {{ nullable?: boolean }} [options]
   * @returns {Schema}
   */
  color({ nullable = false } = {}) {
    return {
      info: { type: 'color', nullable },
      normalize(input, fallback, ctx) {
        if (input === undefined) return fallback;
        if (input === null && nullable) return null;
        if (typeof input !== 'string' || !HEX_COLOR.test(input)) {
          return invalid(ctx, input, fallback);
        }
        return normalizeHex(input);
      },
    };
  },

  /**
   * 列挙値
   * @param {readonly (string | null)[]} values
   * @returns {Schema}
   */
  oneOf(values) {
    return {
      info: { type: 'oneOf', values },
      normalize(input, fallback, ctx) {
        if (input === undefined) return fallback;
        return values.includes(/** @type {any} */ (input)) ? input : invalid(ctx, input, fallback);
      },
    };
  },

  /**
   * 利用者が自由に入れるオブジェクト（中身は JSON で表せる値なら何でもよい）。
   * パッチではマージせず、まるごと置き換える
   * @param {{ nullable?: boolean }} [options]
   * @returns {Schema}
   */
  record({ nullable = false } = {}) {
    return {
      info: { type: 'record', nullable },
      normalize(input, fallback, ctx) {
        if (input === undefined) return clone(fallback);
        if (input === null && nullable) return null;
        if (!isPlainObject(input) || !isJsonValue(input)) return invalid(ctx, input, fallback);
        return input;
      },
    };
  },

  /**
   * 上下左右の余白。数値 1 つなら 4 辺に同じ値を使う
   * @returns {Schema}
   */
  spacing() {
    const side = s.number({ min: 0, max: 1000 });
    return {
      info: { type: 'spacing', min: 0, max: 1000 },
      normalize(input, fallback, ctx) {
        if (input === undefined) return clone(fallback);
        if (typeof input === 'number') {
          const value = side.normalize(input, null, ctx);
          return value === null
            ? clone(fallback)
            : { top: value, right: value, bottom: value, left: value };
        }
        return s
          .object({ top: side, right: side, bottom: side, left: side })
          .normalize(input, fallback, ctx);
      },
    };
  },

  /**
   * @param {Record<string, Schema>} shape
   * @returns {Schema}
   */
  object(shape) {
    return {
      info: { type: 'object', shape },
      normalize(input, fallback, ctx) {
        if (input === undefined) return clone(fallback);
        if (!isPlainObject(input)) return invalid(ctx, input, fallback);
        /** @type {Record<string, unknown>} */
        const result = {};
        for (const [key, schema] of Object.entries(shape)) {
          result[key] = schema.normalize(input[key], fallback?.[key], child(ctx, key));
        }
        for (const key of Object.keys(input)) {
          if (!Object.hasOwn(shape, key)) {
            warn(child(ctx, key), 'unknown-key', `Unknown key "${key}" was removed.`);
          }
        }
        return result;
      },
    };
  },

  /**
   * 配列。要素が不正なら取り除く
   * @param {Schema} item 要素のスキーマ
   * @param {() => unknown} itemDefault 要素の既定値（欠けた項目の補完に使う）
   * @returns {Schema}
   */
  arrayOf(item, itemDefault) {
    return {
      info: { type: 'array', item, itemDefault },
      normalize(input, fallback, ctx) {
        if (input === undefined) return clone(fallback);
        if (!Array.isArray(input)) return invalid(ctx, input, fallback);
        const result = [];
        for (let i = 0; i < input.length; i++) {
          const itemCtx = child(ctx, `[${i}]`);
          const before = itemCtx.warnings.length;
          const value = item.normalize(input[i], itemDefault(), itemCtx);
          const broken = itemCtx.warnings
            .slice(before)
            .some((w) => w.path === itemCtx.path && w.code === 'invalid-value');
          if (!broken) result.push(value);
        }
        return result;
      },
    };
  },
};

/**
 * スキーマに沿って patch を current に深くマージする。
 * object の項目は再帰的にマージし、record・配列・その他の値は置き換える
 * （record はマージすると前の値のキーが残ってしまうため）
 * @param {Schema} schema
 * @param {unknown} current
 * @param {unknown} patch
 * @returns {unknown}
 */
export function mergeBySchema(schema, current, patch) {
  if (patch === undefined) return current;
  const info = schema.info;
  if (info?.type !== 'object' && info?.type !== 'spacing') return patch;
  if (!isPlainObject(current) || !isPlainObject(patch)) return patch;
  /** @type {Record<string, unknown>} */
  const result = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const childSchema = info.type === 'object' ? info.shape?.[key] : undefined;
    result[key] = childSchema ? mergeBySchema(childSchema, current[key], value) : value;
  }
  return result;
}

/**
 * スキーマで値を正規化し、警告も返す（ctx を持たない呼び出し用）
 * @param {Schema} schema
 * @param {unknown} input
 * @param {unknown} fallback
 * @param {string} [path]
 * @returns {{ value: any, warnings: Warning[] }}
 */
export function normalizeWith(schema, input, fallback, path = '') {
  /** @type {Warning[]} */
  const warnings = [];
  const value = schema.normalize(input, fallback, { path, warnings });
  return { value, warnings };
}
