// 保存した行・ブロック（コンポーネント）。エディタで作った行やブロックを切り出して保存し、
// 別のメールに複製して使う。挿入した後は普通の行・ブロックで、元のコンポーネントとはつながらない
import { MailmasonError } from './errors.js';
import { TEMPLATE_VERSION, cloneBlock, cloneRow } from './model/factory.js';
import { defaultBodySettings } from './model/settings.js';
import { locateBlock } from './model/tree.js';
import { isPlainObject } from './model/utils.js';
import { migrate } from './migrate/index.js';

/** @import { Block, Row, Template } from './model/types.js' */
/** @import { Warning } from './model/schema.js' */
/** @import { MergeTagDelimiters } from './merge-tags.js' */
/** @import { CoreBlockDef } from './blocks/types.js' */

/**
 * 保存するコンポーネント。id はアプリが保存するときに付ける（エディタは付けない）
 * @typedef {Object} Component
 * @property {string} [id] アプリが付ける ID（一覧の中で重複しない値）
 * @property {string} name 表示名
 * @property {'row' | 'block'} kind 行か、ブロック 1 つか
 * @property {number} version 作ったときのテンプレートのバージョン
 * @property {Row | Block} content 行（カラムと中のブロックを含む）またはブロック
 */

/**
 * テンプレートの行またはブロックをコンポーネントとして切り出す（中身は複製）
 * @param {Template} template
 * @param {string} id 行またはブロックの ID
 * @param {{ name: string }} options
 * @returns {Component | null} 見つからなければ null
 */
export function extractComponent(template, id, options) {
  const name = options.name.trim();
  const rowIndex = template.body.rows.findIndex((row) => row.id === id);
  if (rowIndex !== -1) {
    return {
      name,
      kind: 'row',
      version: TEMPLATE_VERSION,
      content: structuredClone(template.body.rows[rowIndex]),
    };
  }
  const loc = locateBlock(template, id);
  if (!loc) return null;
  const block = template.body.rows[loc.rowIndex].columns[loc.columnIndex].blocks[loc.blockIndex];
  return { name, kind: 'block', version: TEMPLATE_VERSION, content: structuredClone(block) };
}

/**
 * コンポーネントを、テンプレートに入れられる行またはブロックにする。
 * 中身は読み込み時と同じように整え（古いバージョンや不正な値を直す）、ID は振り直す
 * @param {unknown} component
 * @param {{ blocks?: readonly CoreBlockDef[] | null, mergeTagDelimiters?: MergeTagDelimiters }} [options]
 * @returns {{ kind: 'row', row: Row, warnings: Warning[] } | { kind: 'block', block: Block, warnings: Warning[] }}
 * @throws {MailmasonError} invalid-component（形が違う）/ unsupported-version（新しいバージョン）
 */
export function instantiateComponent(component, options = {}) {
  if (!isPlainObject(component) || !isPlainObject(component.content)) {
    throw new MailmasonError('invalid-component', 'Component must have a content object.');
  }
  const { kind, content } = component;
  if (kind !== 'row' && kind !== 'block') {
    throw new MailmasonError(
      'invalid-component',
      `Unknown component kind ${JSON.stringify(kind)}.`,
    );
  }
  const version = typeof component.version === 'number' ? component.version : TEMPLATE_VERSION;
  const row =
    kind === 'row'
      ? content
      : { id: 'r_component', layout: '1', columns: [{ id: 'c_component', blocks: [content] }] };
  const { template, warnings } = migrate(
    { version, body: { settings: defaultBodySettings(), rows: [row] } },
    options,
  );
  const [normalized] = template.body.rows;
  if (!normalized) throw new MailmasonError('invalid-component', 'Component has no content.');
  if (kind === 'row') return { kind, row: cloneRow(normalized), warnings };
  const [block] = normalized.columns[0]?.blocks ?? [];
  if (!block) throw new MailmasonError('invalid-component', 'Component has no block.');
  return { kind, block: cloneBlock(block), warnings };
}

/**
 * 行またはブロックの ID か（コンポーネントとして保存できるか）
 * @param {Template} template
 * @param {string | null} id
 * @returns {'row' | 'block' | null}
 */
export function componentKindOf(template, id) {
  if (!id) return null;
  if (template.body.rows.some((row) => row.id === id)) return 'row';
  return locateBlock(template, id) ? 'block' : null;
}
