// 行・ブロックのコピー＆貼り付け。OS のクリップボードに JSON を入れるので、別のタブ・別のアプリの Mailmason にも貼り付けられる。
// 形式: { mailmason: 'clipboard', version, kind: 'rows' | 'blocks', items: Row[] | Block[] }（text/plain と独自の MIME の両方に入れる）
import { TEMPLATE_VERSION, cloneBlock, cloneRow, createRow } from '../core/model/factory.js';
import { findRowIndex, locateBlock, locateColumn } from '../core/model/tree.js';
import { instantiateComponent } from '../core/components.js';
import { isPlainObject } from '../core/model/utils.js';

/** @import { Block, Row, Template } from '../core/model/types.js' */
/** @import { Command } from '../core/store/commands.js' */
/** @import { Warning } from '../core/model/schema.js' */

/** 独自の MIME（同じブラウザの中ではこちらを優先して読む） */
export const CLIPBOARD_TYPE = 'application/x-mailmason+json';

/**
 * @typedef {Object} ClipboardPayload
 * @property {'clipboard'} mailmason
 * @property {number} version テンプレート JSON の形式
 * @property {'rows' | 'blocks'} kind
 * @property {Array<Row | Block>} items 上から順
 */

/**
 * 選んだ行・ブロックを、テンプレートでの順番に並べてクリップボードの形にする
 * @param {Template} template
 * @param {readonly string[]} ids
 * @returns {ClipboardPayload | null} 行・ブロックが無ければ null
 */
export function createPayload(template, ids) {
  const wanted = new Set(ids);
  /** @type {Row[]} */
  const rows = [];
  /** @type {Block[]} */
  const blocks = [];
  for (const row of template.body.rows) {
    if (wanted.has(row.id)) rows.push(row);
    for (const column of row.columns) {
      for (const block of column.blocks) if (wanted.has(block.id)) blocks.push(block);
    }
  }
  if (rows.length > 0) {
    return {
      mailmason: 'clipboard',
      version: TEMPLATE_VERSION,
      kind: 'rows',
      items: structuredClone(rows),
    };
  }
  if (blocks.length > 0) {
    return {
      mailmason: 'clipboard',
      version: TEMPLATE_VERSION,
      kind: 'blocks',
      items: structuredClone(blocks),
    };
  }
  return null;
}

/**
 * クリップボードの文字列を読む（Mailmason の形でなければ null）
 * @param {string | null | undefined} text
 * @returns {ClipboardPayload | null}
 */
export function parsePayload(text) {
  if (!text || !text.trimStart().startsWith('{')) return null;
  try {
    const data = JSON.parse(text);
    if (
      isPlainObject(data) &&
      data.mailmason === 'clipboard' &&
      (data.kind === 'rows' || data.kind === 'blocks') &&
      Array.isArray(data.items) &&
      data.items.length > 0
    ) {
      return /** @type {ClipboardPayload} */ (data);
    }
  } catch {
    // JSON でなければ Mailmason のデータではない
  }
  return null;
}

/**
 * copy / cut イベントのクリップボードに入れる
 * @param {ClipboardEvent} event
 * @param {ClipboardPayload} payload
 * @returns {boolean} 入れられたか
 */
export function writeToEvent(event, payload) {
  const data = event.clipboardData;
  if (!data) return false;
  const json = JSON.stringify(payload);
  data.setData('text/plain', json);
  try {
    data.setData(CLIPBOARD_TYPE, json);
  } catch {
    // 独自の MIME を使えないブラウザでは text/plain だけ
  }
  return true;
}

/**
 * paste イベントのクリップボードから読む
 * @param {ClipboardEvent} event
 * @returns {ClipboardPayload | null}
 */
export function readFromEvent(event) {
  const data = event.clipboardData;
  if (!data) return null;
  /** @param {string} type */
  const get = (type) => {
    try {
      return data.getData(type);
    } catch {
      return '';
    }
  };
  return parsePayload(get(CLIPBOARD_TYPE)) ?? parsePayload(get('text/plain'));
}

/**
 * 貼り付けを、テンプレートに入れる行・ブロックにする（読み込み時と同じように整え、ID を振り直す）。
 * 入れられないもの（このエディタに無いカスタムブロックなど）は除いて警告にする
 * @param {ClipboardPayload} payload
 * @param {{ blocks?: readonly import('../core/blocks/types.js').CoreBlockDef[] | null }} [options]
 * @returns {{ rows: Row[], blocks: Block[], warnings: Warning[] }}
 */
export function instantiatePayload(payload, options = {}) {
  /** @type {Row[]} */
  const rows = [];
  /** @type {Block[]} */
  const blocks = [];
  /** @type {Warning[]} */
  const warnings = [];
  const kind = payload.kind === 'rows' ? 'row' : 'block';
  payload.items.forEach((content, i) => {
    try {
      const result = instantiateComponent(
        { name: '', kind, version: payload.version, content },
        options,
      );
      warnings.push(...result.warnings.map((w) => ({ ...w, path: `clipboard[${i}].${w.path}` })));
      if (result.kind === 'row') rows.push(result.row);
      else blocks.push(result.block);
    } catch (error) {
      warnings.push({
        code: 'invalid-value',
        path: `clipboard[${i}]`,
        message: `Could not paste an item: ${/** @type {Error} */ (error).message}`,
      });
    }
  });
  return { rows, blocks, warnings };
}

/**
 * 貼り付ける位置を決めて、コマンドにする。
 * 行: 選択中の要素を含む行の後ろ（無ければ末尾）。
 * ブロック: 選択中のブロックの後ろ・選択中のカラムの末尾・選択中の行の最初のカラムの末尾。何も選んでいなければ新しい行にして末尾
 * @param {Template} template
 * @param {string | null} selection
 * @param {{ rows: Row[], blocks: Block[] }} items
 * @returns {{ commands: Command[], ids: string[] }} 入れた行・ブロックの ID
 */
export function pasteCommands(template, selection, items) {
  const { rows } = template.body;
  if (items.rows.length > 0) {
    let index = rows.length;
    if (selection) {
      const hit =
        locateBlock(template, selection)?.rowIndex ??
        locateColumn(template, selection)?.rowIndex ??
        findRowIndex(template, selection);
      if (hit !== -1) index = hit + 1;
    }
    return {
      commands: items.rows.map((row, i) => ({ type: 'addRow', row, index: index + i })),
      ids: items.rows.map((row) => row.id),
    };
  }
  if (items.blocks.length === 0) return { commands: [], ids: [] };
  const ids = items.blocks.map((block) => block.id);
  const inBlock = selection ? locateBlock(template, selection) : null;
  const inColumn = selection ? locateColumn(template, selection) : null;
  const rowIndex = selection ? findRowIndex(template, selection) : -1;
  /**
   * @param {string} columnId
   * @param {number} start
   * @returns {Command[]}
   */
  const into = (columnId, start) =>
    items.blocks.map((block, i) => ({ type: 'addBlock', columnId, index: start + i, block }));
  if (inBlock) {
    const column = rows[inBlock.rowIndex].columns[inBlock.columnIndex];
    return { commands: into(column.id, inBlock.blockIndex + 1), ids };
  }
  if (inColumn) {
    const column = rows[inColumn.rowIndex].columns[inColumn.columnIndex];
    return { commands: into(column.id, column.blocks.length), ids };
  }
  if (rowIndex !== -1) {
    const column = rows[rowIndex].columns[0];
    return { commands: into(column.id, column.blocks.length), ids };
  }
  return { commands: [{ type: 'addRow', row: createRow('1', [items.blocks]) }], ids };
}

/**
 * 選んだ行・ブロックを、それぞれの直後に複製するコマンド
 * @param {Template} template
 * @param {readonly string[]} ids
 * @returns {{ commands: Command[], ids: string[] }} 複製の ID
 */
export function duplicateCommands(template, ids) {
  const wanted = new Set(ids);
  /** @type {Command[]} */
  const commands = [];
  /** @type {string[]} */
  const copies = [];
  // 後ろから入れて、前の位置がずれないようにする
  const { rows } = template.body;
  for (let r = rows.length - 1; r >= 0; r -= 1) {
    const row = rows[r];
    if (wanted.has(row.id)) {
      const copy = cloneRow(row);
      commands.push({ type: 'addRow', row: copy, index: r + 1 });
      copies.unshift(copy.id);
      continue;
    }
    for (const column of [...row.columns].reverse()) {
      for (let b = column.blocks.length - 1; b >= 0; b -= 1) {
        const block = column.blocks[b];
        if (!wanted.has(block.id)) continue;
        const copy = cloneBlock(block);
        commands.push({ type: 'addBlock', columnId: column.id, index: b + 1, block: copy });
        copies.unshift(copy.id);
      }
    }
  }
  return { commands, ids: copies };
}

/**
 * 選んだ行・ブロックを消すコマンド
 * @param {Template} template
 * @param {readonly string[]} ids
 * @returns {Command[]}
 */
export function removeCommands(template, ids) {
  /** @type {Command[]} */
  const commands = [];
  for (const id of ids) {
    if (findRowIndex(template, id) !== -1) commands.push({ type: 'removeRow', rowId: id });
    else if (locateBlock(template, id)) commands.push({ type: 'removeBlock', blockId: id });
  }
  return commands;
}
