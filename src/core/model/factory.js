import { MailmasonError } from '../errors.js';
import { getBlockDef } from '../blocks/registry.js';
import { getLayoutSpans, isRowLayout } from './layout.js';
import { normalizeWith } from './schema.js';
import {
  blockStyleSchema,
  defaultBlockStyle,
  defaultBodySettings,
  defaultColumnSettings,
  defaultRowSettings,
} from './settings.js';
import { deepMerge } from './utils.js';

/** @import { Block, BodySettings, Column, Row, RowLayout, Template } from './types.js' */

/** テンプレート JSON の現行バージョン */
export const TEMPLATE_VERSION = 1;

const ID_LENGTH = 8;
const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * 要素 ID を生成する。例: `r_k3x9a0bz`
 * @param {'r' | 'c' | 'b'} prefix 行 = r、カラム = c、ブロック = b
 * @returns {string}
 */
export function createId(prefix) {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  let id = '';
  for (const byte of bytes) id += ID_CHARS[byte % ID_CHARS.length];
  return `${prefix}_${id}`;
}

/**
 * 空のテンプレートを作る
 * @param {Partial<BodySettings>} [theme] ボディ設定の初期値（ホストアプリの theme）
 * @returns {Template}
 */
export function createTemplate(theme = {}) {
  return {
    version: TEMPLATE_VERSION,
    body: {
      settings: { ...defaultBodySettings(), ...theme },
      rows: [],
    },
    text: { mode: 'auto', content: null, sourceHash: null },
  };
}

/**
 * 空のカラムを作る
 * @param {Block[]} [blocks]
 * @returns {Column}
 */
export function createColumn(blocks = []) {
  return { id: createId('c'), settings: defaultColumnSettings(), blocks };
}

/**
 * 行を作る
 * @param {RowLayout} [layout]
 * @param {Block[][]} [columnBlocks] カラムごとの初期ブロック（`columnBlocks[i]` が i 番目のカラム）
 * @returns {Row}
 */
export function createRow(layout = '1', columnBlocks = []) {
  if (!isRowLayout(layout)) {
    throw new MailmasonError('invalid-layout', `Unknown row layout "${layout}".`);
  }
  const columns = getLayoutSpans(layout).map((_, i) => createColumn(columnBlocks[i] ?? []));
  return { id: createId('r'), layout, settings: defaultRowSettings(), columns };
}

/**
 * ブロックを作る。values は既定値に深くマージしたうえでスキーマで整える
 * @param {string} type
 * @param {Record<string, unknown>} [values]
 * @param {{ blocks?: readonly import('../blocks/types.js').CoreBlockDef[] | null }} [options] blocks: カスタムブロックの定義
 * @returns {Block}
 */
export function createBlock(type, values = {}, options = {}) {
  const def = getBlockDef(type, options.blocks);
  if (!def) {
    throw new MailmasonError('unknown-block-type', `Unknown block type "${type}".`);
  }
  const defaults = def.defaults();
  const merged = normalizeWith(def.schema, deepMerge(defaults, values), defaults).value;
  const style = def.defaultStyle ? def.defaultStyle() : defaultBlockStyle();
  return {
    id: createId('b'),
    type,
    values: merged,
    style: normalizeWith(blockStyleSchema, style, defaultBlockStyle()).value,
    hideOn: null,
  };
}

/**
 * ブロックを複製する（新しい ID を振る）
 * @param {Block} block
 * @returns {Block}
 */
export function cloneBlock(block) {
  return { ...structuredClone(block), id: createId('b') };
}

/**
 * カラムを複製する（配下のブロックも含めて新しい ID を振る）
 * @param {Column} column
 * @returns {Column}
 */
export function cloneColumn(column) {
  return {
    ...structuredClone(column),
    id: createId('c'),
    blocks: column.blocks.map(cloneBlock),
  };
}

/**
 * 行を複製する（配下すべてに新しい ID を振る）
 * @param {Row} row
 * @returns {Row}
 */
export function cloneRow(row) {
  return {
    ...structuredClone(row),
    id: createId('r'),
    columns: row.columns.map(cloneColumn),
  };
}
