// 読込時の正規化。壊れたデータでも可能な限り読み込み、直した箇所を警告として返す。
import { getBlockDef } from '../blocks/registry.js';
import { createColumn, createId, TEMPLATE_VERSION } from '../model/factory.js';
import { getLayoutSpans, isRowLayout, layoutForColumnCount } from '../model/layout.js';
import { child, warn } from '../model/schema.js';
import {
  blockStyleSchema,
  bodySettingsSchema,
  columnSettingsSchema,
  defaultBlockStyle,
  defaultBodySettings,
  defaultColumnSettings,
  defaultRowSettings,
  hideOnSchema,
  rowSettingsSchema,
  textPartSchema,
} from '../model/settings.js';
import { isEqual, isPlainObject } from '../model/utils.js';
import { DEFAULT_DELIMITERS } from '../merge-tags.js';

/** @import { NormalizeContext } from '../model/schema.js' */
/** @import { Block, Column, Row, RowLayout, Template } from '../model/types.js' */
/** @import { MergeTagDelimiters } from '../merge-tags.js' */

/**
 * @typedef {Object} NormalizeOptions
 * @property {MergeTagDelimiters} delimiters
 * @property {readonly import('../blocks/types.js').CoreBlockDef[] | null} [blocks] カスタムブロックの定義
 */

/**
 * @param {Record<string, unknown>} input
 * @param {readonly string[]} known
 * @param {NormalizeContext} ctx
 */
function warnUnknownKeys(input, known, ctx) {
  for (const key of Object.keys(input)) {
    if (!known.includes(key)) {
      warn(child(ctx, key), 'unknown-key', `Unknown key "${key}" was removed.`);
    }
  }
}

/**
 * ID を検証し、欠落・重複していれば振り直す
 * @param {unknown} value
 * @param {'r' | 'c' | 'b'} prefix
 * @param {Set<string>} used
 * @param {NormalizeContext} ctx
 * @returns {string}
 */
function ensureId(value, prefix, used, ctx) {
  if (typeof value === 'string' && value.length > 0 && !used.has(value)) {
    used.add(value);
    return value;
  }
  let id = createId(prefix);
  while (used.has(id)) id = createId(prefix);
  used.add(id);
  warn(
    child(ctx, 'id'),
    'regenerated-id',
    `${value === undefined ? 'Missing' : 'Invalid or duplicate'} id ${JSON.stringify(value ?? null)}; assigned "${id}".`,
  );
  return id;
}

/**
 * @param {unknown} input
 * @param {Set<string>} ids
 * @param {NormalizeContext} ctx
 * @param {NormalizeOptions} options
 * @returns {Block | null} 復元できないときは null
 */
function normalizeBlock(input, ids, ctx, options) {
  if (!isPlainObject(input) || typeof input.type !== 'string') {
    warn(ctx, 'invalid-value', 'Not a valid block; it was removed.');
    return null;
  }
  const def = getBlockDef(input.type, options.blocks);
  const id = ensureId(input.id, 'b', ids, ctx);
  let values;
  if (def) {
    values = def.schema.normalize(input.values, def.defaults(), child(ctx, 'values'));
    if (def.sanitize) {
      const sanitized = def.sanitize(values, { delimiters: options.delimiters });
      if (!isEqual(sanitized, values)) {
        warn(
          child(ctx, 'values'),
          'sanitized-html',
          'Rich text was normalized to the allowed HTML.',
        );
        values = sanitized;
      }
    }
  } else {
    // 新しいライブラリで作られたブロックかもしれないので、内容は捨てずに保持する
    warn(ctx, 'unknown-block-type', `Unknown block type "${input.type}"; kept but not rendered.`);
    values = isPlainObject(input.values) ? input.values : {};
  }
  const style = blockStyleSchema.normalize(
    input.style,
    def?.defaultStyle ? def.defaultStyle() : defaultBlockStyle(),
    child(ctx, 'style'),
  );
  const hideOn = hideOnSchema.normalize(input.hideOn, null, child(ctx, 'hideOn'));
  warnUnknownKeys(input, ['id', 'type', 'values', 'style', 'hideOn'], ctx);
  return { id, type: input.type, values, style, hideOn };
}

/**
 * @param {unknown} input
 * @param {NormalizeContext} ctx
 * @returns {unknown[]}
 */
function asArray(input, ctx) {
  if (input === undefined) return [];
  if (Array.isArray(input)) return input;
  warn(ctx, 'invalid-value', 'Expected an array; replaced with an empty array.');
  return [];
}

/**
 * @param {unknown} input
 * @param {Set<string>} ids
 * @param {NormalizeContext} ctx
 * @param {NormalizeOptions} options
 * @returns {Column | null}
 */
function normalizeColumn(input, ids, ctx, options) {
  if (!isPlainObject(input)) {
    warn(ctx, 'invalid-value', 'Not a valid column; it was removed.');
    return null;
  }
  const id = ensureId(input.id, 'c', ids, ctx);
  const settings = columnSettingsSchema.normalize(
    input.settings,
    defaultColumnSettings(),
    child(ctx, 'settings'),
  );
  const blocksCtx = child(ctx, 'blocks');
  /** @type {Block[]} */
  const blocks = [];
  asArray(input.blocks, blocksCtx).forEach((raw, i) => {
    const block = normalizeBlock(raw, ids, child(blocksCtx, `[${i}]`), options);
    if (block) blocks.push(block);
  });
  warnUnknownKeys(input, ['id', 'settings', 'blocks'], ctx);
  return { id, settings, blocks };
}

/**
 * @param {unknown} input
 * @param {Set<string>} ids
 * @param {NormalizeContext} ctx
 * @param {NormalizeOptions} options
 * @returns {Row | null}
 */
function normalizeRow(input, ids, ctx, options) {
  if (!isPlainObject(input)) {
    warn(ctx, 'invalid-value', 'Not a valid row; it was removed.');
    return null;
  }
  const id = ensureId(input.id, 'r', ids, ctx);
  const settings = rowSettingsSchema.normalize(
    input.settings,
    defaultRowSettings(),
    child(ctx, 'settings'),
  );

  const columnsCtx = child(ctx, 'columns');
  /** @type {Column[]} */
  let columns = [];
  asArray(input.columns, columnsCtx).forEach((raw, i) => {
    const column = normalizeColumn(raw, ids, child(columnsCtx, `[${i}]`), options);
    if (column) columns.push(column);
  });

  /** @type {RowLayout} */
  let layout;
  if (isRowLayout(input.layout)) {
    layout = input.layout;
  } else {
    layout = layoutForColumnCount(columns.length) ?? '1';
    if (input.layout !== undefined || columns.length !== 1) {
      warn(
        child(ctx, 'layout'),
        'invalid-value',
        `Invalid layout ${JSON.stringify(input.layout ?? null)}; using "${layout}".`,
      );
    }
  }

  const count = getLayoutSpans(layout).length;
  if (columns.length !== count) {
    warn(
      columnsCtx,
      'layout-mismatch',
      `Layout "${layout}" needs ${count} column(s) but found ${columns.length}; adjusted.`,
    );
    if (columns.length > count) {
      // 余ったカラムのブロックは、残す最後のカラムの末尾へ移す（内容を失わない）
      const extra = columns.slice(count).flatMap((column) => column.blocks);
      columns = columns.slice(0, count);
      const last = columns[count - 1];
      columns[count - 1] = { ...last, blocks: [...last.blocks, ...extra] };
    } else {
      while (columns.length < count) {
        const column = createColumn();
        while (ids.has(column.id)) column.id = createId('c');
        ids.add(column.id);
        columns.push(column);
      }
    }
  }

  warnUnknownKeys(input, ['id', 'layout', 'settings', 'columns'], ctx);
  return { id, layout, settings, columns };
}

/**
 * 形の整ったテンプレートを返す。入力は変更しない
 * @param {Record<string, unknown>} input
 * @param {NormalizeContext} ctx
 * @param {Partial<NormalizeOptions>} [options]
 * @returns {Template}
 */
export function normalizeTemplate(input, ctx, options = {}) {
  const resolved = {
    delimiters: options.delimiters ?? DEFAULT_DELIMITERS,
    blocks: options.blocks ?? null,
  };
  /** @type {Set<string>} */
  const ids = new Set();

  const bodyCtx = child(ctx, 'body');
  let body = input.body;
  if (body !== undefined && !isPlainObject(body)) {
    warn(bodyCtx, 'invalid-value', 'Invalid body; replaced with an empty body.');
    body = undefined;
  }
  const rawBody = /** @type {Record<string, unknown>} */ (body ?? {});

  const settings = bodySettingsSchema.normalize(
    rawBody.settings,
    defaultBodySettings(),
    child(bodyCtx, 'settings'),
  );
  const rowsCtx = child(bodyCtx, 'rows');
  /** @type {Row[]} */
  const rows = [];
  asArray(rawBody.rows, rowsCtx).forEach((raw, i) => {
    const row = normalizeRow(raw, ids, child(rowsCtx, `[${i}]`), resolved);
    if (row) rows.push(row);
  });
  warnUnknownKeys(rawBody, ['settings', 'rows'], bodyCtx);

  const textCtx = child(ctx, 'text');
  const text = textPartSchema.normalize(
    input.text,
    { mode: 'auto', content: null, sourceHash: null },
    textCtx,
  );
  if (text.mode === 'manual' && text.content === null) {
    warn(textCtx, 'invalid-value', 'Manual text mode without content; switched to auto.');
    text.mode = 'auto';
    text.sourceHash = null;
  }

  warnUnknownKeys(input, ['version', 'body', 'text'], ctx);
  return { version: TEMPLATE_VERSION, body: { settings, rows }, text };
}
