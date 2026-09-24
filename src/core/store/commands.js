// 編集コマンド。すべて純粋関数 (template, command) => template で、変化がなければ同じ参照を返す。
// UI はテンプレートを直接書き換えず、必ずコマンドを経由する（Undo/Redo と変更通知の一元化のため）。
import { MailmasonError } from '../errors.js';
import { getBlockDef } from '../blocks/registry.js';
import { cloneBlock, cloneRow, createBlock, createColumn, createRow } from '../model/factory.js';
import { getLayoutSpans, isRowLayout } from '../model/layout.js';
import {
  blockStyleSchema,
  bodySettingsSchema,
  columnSettingsSchema,
  hideOnSchema,
  rowSettingsSchema,
} from '../model/settings.js';
import {
  clamp,
  collectIds,
  findRowIndex,
  idsInRow,
  locateBlock,
  locateColumn,
  moveItem,
  replaceColumn,
  replaceRow,
  withRows,
} from '../model/tree.js';
import { isEqual } from '../model/utils.js';
import { mergeBySchema } from '../model/schema.js';

/** @import { Schema, Warning } from '../model/schema.js' */
/** @import { Block, BodySettings, Column, Row, RowLayout, RowSettings, Template } from '../model/types.js' */

/**
 * @typedef {{ type: 'addRow', layout?: RowLayout, index?: number, row?: Row }} AddRowCommand
 *   row を渡すとその行を挿入する（ブロック入りの行を 1 手で追加したいとき）
 * @typedef {{ type: 'moveRow', rowId: string, index: number }} MoveRowCommand
 *   index は移動元を取り除いた後の配列での位置
 * @typedef {{ type: 'duplicateRow', rowId: string }} DuplicateRowCommand
 * @typedef {{ type: 'removeRow', rowId: string }} RemoveRowCommand
 * @typedef {{ type: 'setRowLayout', rowId: string, layout: RowLayout }} SetRowLayoutCommand
 * @typedef {{ type: 'updateRowSettings', rowId: string, patch: Partial<RowSettings> }} UpdateRowSettingsCommand
 * @typedef {{ type: 'updateColumnSettings', columnId: string, patch: Partial<Column['settings']> }} UpdateColumnSettingsCommand
 * @typedef {{ type: 'updateBodySettings', patch: Partial<BodySettings> }} UpdateBodySettingsCommand
 * @typedef {{ type: 'addBlock', columnId: string, index?: number, block?: Block, blockType?: string, values?: Record<string, unknown> }} AddBlockCommand
 *   block か blockType（＋ values）のどちらかを指定する
 * @typedef {{ type: 'moveBlock', blockId: string, columnId: string, index: number }} MoveBlockCommand
 *   index は移動元を取り除いた後の、移動先カラムでの位置
 * @typedef {{ type: 'moveBlockToNewRow', blockId: string, index: number, layout?: RowLayout }} MoveBlockToNewRowCommand
 *   ブロックを取り除き、新しい行（既定は 1 カラム）の先頭カラムに入れて index の位置に挿入する
 * @typedef {{ type: 'duplicateBlock', blockId: string }} DuplicateBlockCommand
 * @typedef {{ type: 'removeBlock', blockId: string }} RemoveBlockCommand
 * @typedef {{ type: 'updateBlockValues', blockId: string, patch: Record<string, unknown> }} UpdateBlockValuesCommand
 *   patch は values に深くマージする（配列は置き換え）
 * @typedef {{ type: 'updateBlockStyle', blockId: string, patch: Partial<Block['style']> }} UpdateBlockStyleCommand
 * @typedef {{ type: 'setBlockHideOn', blockId: string, hideOn: 'mobile' | null }} SetBlockHideOnCommand
 * @typedef {{ type: 'setTextPart', content: string, sourceHash?: string | null }} SetTextPartCommand
 * @typedef {{ type: 'resetTextPart' }} ResetTextPartCommand
 * @typedef {{ type: 'loadTemplate', template: Template }} LoadTemplateCommand
 *   正規化済みのテンプレートを渡すこと（外部データは先に migrate() を通す）
 */

/**
 * @typedef {(AddRowCommand | MoveRowCommand | DuplicateRowCommand | RemoveRowCommand
 *   | SetRowLayoutCommand | UpdateRowSettingsCommand | UpdateColumnSettingsCommand
 *   | UpdateBodySettingsCommand | AddBlockCommand | MoveBlockCommand | MoveBlockToNewRowCommand
 *   | DuplicateBlockCommand
 *   | RemoveBlockCommand | UpdateBlockValuesCommand | UpdateBlockStyleCommand
 *   | SetBlockHideOnCommand | SetTextPartCommand | ResetTextPartCommand | LoadTemplateCommand)
 *   & { mergeKey?: string }} Command
 *   mergeKey: 同じ値のコマンドが短時間に続いたら、ストアが 1 つの履歴にまとめる
 */

/**
 * @param {string} kind
 * @param {string} id
 * @returns {never}
 */
function notFound(kind, id) {
  throw new MailmasonError('not-found', `${kind} "${id}" was not found.`);
}

/**
 * @param {Template} template
 * @param {string} rowId
 */
function requireRow(template, rowId) {
  const index = findRowIndex(template, rowId);
  if (index === -1) notFound('Row', rowId);
  return index;
}

/**
 * @param {Template} template
 * @param {string} columnId
 */
function requireColumn(template, columnId) {
  return locateColumn(template, columnId) ?? notFound('Column', columnId);
}

/**
 * @param {Template} template
 * @param {string} blockId
 */
function requireBlock(template, blockId) {
  return locateBlock(template, blockId) ?? notFound('Block', blockId);
}

/**
 * 追加する要素の ID が既存と衝突しないことを確かめる
 * @param {Template} template
 * @param {string[]} ids
 */
function assertNewIds(template, ids) {
  const existing = collectIds(template);
  const seen = new Set();
  for (const id of ids) {
    if (existing.has(id) || seen.has(id)) {
      throw new MailmasonError('duplicate-id', `Id "${id}" already exists in the template.`);
    }
    seen.add(id);
  }
}

/**
 * current に patch を深くマージしてスキーマで整える。不正な値は現在値のまま残し、警告に記録する
 * @template T
 * @param {Schema} schema
 * @param {T} current
 * @param {Record<string, unknown>} patch
 * @param {string} path
 * @param {Warning[]} warnings
 * @returns {T}
 */
function patchWith(schema, current, patch, path, warnings) {
  const merged = mergeBySchema(schema, current, patch);
  const next = schema.normalize(merged, current, { path, warnings });
  return isEqual(next, current) ? current : next;
}

/**
 * コマンドを適用した新しいテンプレートを返す。変化がなければ同じ参照を返す
 * @param {Template} template
 * @param {Command} command
 * @param {Warning[]} [warnings] パッチの不正値などの警告の出力先
 * @param {{ blocks?: readonly import('../blocks/types.js').CoreBlockDef[] | null }} [options] blocks: カスタムブロックの定義
 * @returns {Template}
 * @throws {MailmasonError} not-found / duplicate-id / invalid-layout / unknown-block-type / unknown-command
 */
export function applyCommand(template, command, warnings = [], options = {}) {
  const customBlocks = options.blocks ?? null;
  const { rows } = template.body;

  switch (command.type) {
    case 'addRow': {
      const row = command.row ?? createRow(command.layout ?? '1');
      if (command.row) assertNewIds(template, idsInRow(row));
      const index = clamp(command.index ?? rows.length, 0, rows.length);
      const next = rows.slice();
      next.splice(index, 0, row);
      return withRows(template, next);
    }

    case 'moveRow': {
      const from = requireRow(template, command.rowId);
      const to = clamp(command.index, 0, rows.length - 1);
      return from === to ? template : withRows(template, moveItem(rows, from, to));
    }

    case 'duplicateRow': {
      const index = requireRow(template, command.rowId);
      const next = rows.slice();
      next.splice(index + 1, 0, cloneRow(rows[index]));
      return withRows(template, next);
    }

    case 'removeRow': {
      const index = requireRow(template, command.rowId);
      return withRows(
        template,
        rows.filter((_, i) => i !== index),
      );
    }

    case 'setRowLayout': {
      if (!isRowLayout(command.layout)) {
        throw new MailmasonError('invalid-layout', `Unknown row layout "${command.layout}".`);
      }
      const index = requireRow(template, command.rowId);
      const row = rows[index];
      if (row.layout === command.layout) return template;
      const count = getLayoutSpans(command.layout).length;
      let columns = row.columns.slice(0, count);
      if (row.columns.length > count) {
        // 消えるカラムのブロックは、残る最後のカラムの末尾へ移す（内容を失わない）
        const extra = row.columns.slice(count).flatMap((column) => column.blocks);
        const last = columns[count - 1];
        columns[count - 1] = { ...last, blocks: [...last.blocks, ...extra] };
      }
      while (columns.length < count) columns = [...columns, createColumn()];
      return replaceRow(template, index, { ...row, layout: command.layout, columns });
    }

    case 'updateRowSettings': {
      const index = requireRow(template, command.rowId);
      const row = rows[index];
      const settings = patchWith(
        rowSettingsSchema,
        row.settings,
        command.patch,
        `row(${row.id}).settings`,
        warnings,
      );
      return settings === row.settings
        ? template
        : replaceRow(template, index, { ...row, settings });
    }

    case 'updateColumnSettings': {
      const { rowIndex, columnIndex } = requireColumn(template, command.columnId);
      const column = rows[rowIndex].columns[columnIndex];
      const settings = patchWith(
        columnSettingsSchema,
        column.settings,
        command.patch,
        `column(${column.id}).settings`,
        warnings,
      );
      return settings === column.settings
        ? template
        : replaceColumn(template, rowIndex, columnIndex, { ...column, settings });
    }

    case 'updateBodySettings': {
      const current = template.body.settings;
      const settings = patchWith(
        bodySettingsSchema,
        current,
        command.patch,
        'body.settings',
        warnings,
      );
      return settings === current
        ? template
        : { ...template, body: { ...template.body, settings } };
    }

    case 'addBlock': {
      const { rowIndex, columnIndex } = requireColumn(template, command.columnId);
      let block;
      if (command.block) {
        block = command.block;
        assertNewIds(template, [block.id]);
      } else if (command.blockType) {
        block = createBlock(command.blockType, command.values, { blocks: customBlocks });
      } else {
        throw new MailmasonError('invalid-command', 'addBlock needs either block or blockType.');
      }
      const column = rows[rowIndex].columns[columnIndex];
      const index = clamp(command.index ?? column.blocks.length, 0, column.blocks.length);
      const blocks = column.blocks.slice();
      blocks.splice(index, 0, block);
      return replaceColumn(template, rowIndex, columnIndex, { ...column, blocks });
    }

    case 'moveBlock': {
      const source = requireBlock(template, command.blockId);
      const target = requireColumn(template, command.columnId);
      const sourceColumn = rows[source.rowIndex].columns[source.columnIndex];
      const block = sourceColumn.blocks[source.blockIndex];
      const sameColumn =
        source.rowIndex === target.rowIndex && source.columnIndex === target.columnIndex;

      if (sameColumn) {
        const to = clamp(command.index, 0, sourceColumn.blocks.length - 1);
        if (to === source.blockIndex) return template;
        const blocks = moveItem(sourceColumn.blocks, source.blockIndex, to);
        return replaceColumn(template, source.rowIndex, source.columnIndex, {
          ...sourceColumn,
          blocks,
        });
      }

      const removed = replaceColumn(template, source.rowIndex, source.columnIndex, {
        ...sourceColumn,
        blocks: sourceColumn.blocks.filter((_, i) => i !== source.blockIndex),
      });
      const targetColumn = removed.body.rows[target.rowIndex].columns[target.columnIndex];
      const blocks = targetColumn.blocks.slice();
      blocks.splice(clamp(command.index, 0, blocks.length), 0, block);
      return replaceColumn(removed, target.rowIndex, target.columnIndex, {
        ...targetColumn,
        blocks,
      });
    }

    case 'moveBlockToNewRow': {
      const source = requireBlock(template, command.blockId);
      const sourceColumn = rows[source.rowIndex].columns[source.columnIndex];
      const block = sourceColumn.blocks[source.blockIndex];
      const removed = replaceColumn(template, source.rowIndex, source.columnIndex, {
        ...sourceColumn,
        blocks: sourceColumn.blocks.filter((_, i) => i !== source.blockIndex),
      });
      const row = createRow(command.layout ?? '1', [[block]]);
      const nextRows = removed.body.rows.slice();
      nextRows.splice(clamp(command.index, 0, nextRows.length), 0, row);
      return withRows(removed, nextRows);
    }

    case 'duplicateBlock': {
      const { rowIndex, columnIndex, blockIndex } = requireBlock(template, command.blockId);
      const column = rows[rowIndex].columns[columnIndex];
      const blocks = column.blocks.slice();
      blocks.splice(blockIndex + 1, 0, cloneBlock(column.blocks[blockIndex]));
      return replaceColumn(template, rowIndex, columnIndex, { ...column, blocks });
    }

    case 'removeBlock': {
      const { rowIndex, columnIndex, blockIndex } = requireBlock(template, command.blockId);
      const column = rows[rowIndex].columns[columnIndex];
      return replaceColumn(template, rowIndex, columnIndex, {
        ...column,
        blocks: column.blocks.filter((_, i) => i !== blockIndex),
      });
    }

    case 'updateBlockValues':
    case 'updateBlockStyle':
    case 'setBlockHideOn': {
      const { rowIndex, columnIndex, blockIndex } = requireBlock(template, command.blockId);
      const column = rows[rowIndex].columns[columnIndex];
      const block = column.blocks[blockIndex];
      const path = `block(${block.id})`;
      /** @type {Block} */
      let next = block;

      if (command.type === 'updateBlockValues') {
        const def = getBlockDef(block.type, customBlocks);
        if (!def) {
          throw new MailmasonError(
            'unknown-block-type',
            `Cannot edit block of unknown type "${block.type}".`,
          );
        }
        const values = patchWith(
          def.schema,
          block.values,
          command.patch,
          `${path}.values`,
          warnings,
        );
        if (values !== block.values) next = { ...block, values };
      } else if (command.type === 'updateBlockStyle') {
        const style = patchWith(
          blockStyleSchema,
          block.style,
          command.patch,
          `${path}.style`,
          warnings,
        );
        if (style !== block.style) next = { ...block, style };
      } else {
        const hideOn = hideOnSchema.normalize(command.hideOn, block.hideOn, {
          path: `${path}.hideOn`,
          warnings,
        });
        if (hideOn !== block.hideOn) next = { ...block, hideOn };
      }

      if (next === block) return template;
      const blocks = column.blocks.slice();
      blocks[blockIndex] = next;
      return replaceColumn(template, rowIndex, columnIndex, { ...column, blocks });
    }

    case 'setTextPart': {
      if (typeof command.content !== 'string') {
        throw new MailmasonError('invalid-command', 'setTextPart needs string content.');
      }
      const text = {
        mode: /** @type {const} */ ('manual'),
        content: command.content,
        sourceHash:
          command.sourceHash === undefined ? template.text.sourceHash : command.sourceHash,
      };
      return isEqual(text, template.text) ? template : { ...template, text };
    }

    case 'resetTextPart': {
      if (template.text.mode === 'auto') return template;
      return { ...template, text: { mode: 'auto', content: null, sourceHash: null } };
    }

    case 'loadTemplate':
      return command.template;

    default: {
      const unknown = /** @type {{ type?: unknown }} */ (command);
      throw new MailmasonError(
        'unknown-command',
        `Unknown command ${JSON.stringify(unknown.type)}.`,
      );
    }
  }
}
