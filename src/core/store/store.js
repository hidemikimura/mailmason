// エディタの状態を持つストア。
// - template: 履歴（Undo/Redo）の対象
// - selection: 選択中の要素 ID。UI 状態なので履歴の対象外（ただし Undo 時は当時の選択を復元する）
// - selectedIds: まとめて選んだ要素の ID（行どうし・ブロックどうしだけ。1 つのときは [selection]、無ければ []）
import { applyCommand } from './commands.js';
import { collectIds, findRowIndex, locateBlock } from '../model/tree.js';

/** @import { Command } from './commands.js' */
/** @import { Warning } from '../model/schema.js' */
/** @import { Template } from '../model/types.js' */

/**
 * @typedef {Object} StoreState
 * @property {Template} template
 * @property {string | null} selection 選択中の行・カラム・ブロックの ID（まとめて選んだときは最後に選んだもの）
 * @property {readonly string[]} selectedIds 選択中の要素の ID（まとめて選べるのは行どうし・ブロックどうし）
 */

/**
 * ストアの変更を表す。`command` は dispatch したコマンド、または undo / redo / select
 * @typedef {Command | { type: 'undo' } | { type: 'redo' } | { type: 'select', id: string | null, ids: readonly string[] }} StoreAction
 */

/**
 * @callback StoreListener
 * @param {StoreState} state 変更後
 * @param {StoreState} prev 変更前
 * @param {StoreAction} action
 * @param {Warning[]} warnings コマンド適用時の警告（無ければ空配列）
 * @returns {void}
 */

/**
 * @typedef {Object} HistoryEntry
 * @property {Template} template
 * @property {string | null} selection
 * @property {readonly string[]} selectedIds
 */

/**
 * @typedef {Object} StoreOptions
 * @property {number} [historyLimit] 保持する履歴の上限（既定 100）
 * @property {number} [mergeWindow] mergeKey が同じコマンドをまとめる時間（ms、既定 500）
 * @property {() => number} [now] 現在時刻（テスト用）
 * @property {readonly import('../blocks/types.js').CoreBlockDef[] | (() => readonly import('../blocks/types.js').CoreBlockDef[] | null) | null} [blocks]
 *   カスタムブロックの定義（関数なら毎回呼んで最新の定義を使う）
 */

/**
 * @typedef {Object} Store
 * @property {() => StoreState} getState
 * @property {(command: Command) => boolean} dispatch テンプレートが変化したら true
 * @property {(id: string | readonly string[] | null) => void} select
 *   選択する（配列ならまとめて選ぶ。種類の違うもの・カラムは最後の 1 つに合わせて除く）
 * @property {(id: string) => void} toggleSelect 選択に加える・外す（行どうし・ブロックどうし。種類が違えば選び直す）
 * @property {() => boolean} undo 戻せたら true
 * @property {() => boolean} redo やり直せたら true
 * @property {() => boolean} canUndo
 * @property {() => boolean} canRedo
 * @property {(listener: StoreListener) => () => void} subscribe 解除関数を返す
 */

/** @type {readonly string[]} */
const NONE = Object.freeze([]);

/**
 * 要素の種類
 * @param {Template} template
 * @param {string} id
 * @returns {'row' | 'column' | 'block' | null}
 */
function kindOf(template, id) {
  if (locateBlock(template, id)) return 'block';
  if (findRowIndex(template, id) !== -1) return 'row';
  return collectIds(template).has(id) ? 'column' : null;
}

/**
 * @param {Template} template 正規化済みのテンプレート（外部データは先に migrate() を通す）
 * @param {StoreOptions} [options]
 * @returns {Store}
 */
export function createStore(template, options = {}) {
  const { historyLimit = 100, mergeWindow = 500, now = () => Date.now() } = options;
  const blocks = () =>
    typeof options.blocks === 'function' ? options.blocks() : (options.blocks ?? null);

  /** @type {StoreState} */
  let state = { template, selection: null, selectedIds: NONE };
  /** @type {HistoryEntry[]} */
  let past = [];
  /** @type {HistoryEntry[]} */
  let future = [];
  /** 直前に履歴へ積んだコマンドの mergeKey と時刻（まとめ判定用） */
  let lastMerge = /** @type {{ key: string, time: number } | null} */ (null);
  /** @type {Set<StoreListener>} */
  const listeners = new Set();

  /**
   * @param {StoreState} next
   * @param {StoreAction} action
   * @param {Warning[]} [warnings]
   */
  function commit(next, action, warnings = []) {
    const prev = state;
    state = next;
    for (const listener of [...listeners]) listener(state, prev, action, warnings);
  }

  /**
   * テンプレートにある要素だけを残した選択。まとめて選べるのは行どうし・ブロックどうしで、
   * 種類が違うものは primary（無ければ最後）に合わせて除く
   * @param {Template} tpl
   * @param {readonly string[]} ids
   * @param {string | null} [primary] 最後に選んだ要素
   * @returns {Pick<StoreState, 'selection' | 'selectedIds'>}
   */
  function selectionOf(tpl, ids, primary = null) {
    const existing = collectIds(tpl);
    const valid = [...new Set(ids)].filter((id) => existing.has(id));
    if (valid.length === 0) return { selection: null, selectedIds: NONE };
    const main = primary !== null && valid.includes(primary) ? primary : valid[valid.length - 1];
    const kind = kindOf(tpl, main);
    const selectedIds =
      kind === 'row' || kind === 'block' ? valid.filter((id) => kindOf(tpl, id) === kind) : [main];
    return { selection: main, selectedIds };
  }

  /**
   * 変更後のテンプレートに合わせて、今の選択を直す
   * @param {Template} tpl
   * @param {{ selection: string | null, selectedIds: readonly string[] }} current
   */
  function keepSelection(tpl, current) {
    const next = selectionOf(tpl, current.selectedIds, current.selection);
    return next.selectedIds.length === current.selectedIds.length &&
      next.selection === current.selection
      ? { selection: current.selection, selectedIds: current.selectedIds }
      : next;
  }

  /** @returns {HistoryEntry} */
  function snapshot() {
    return {
      template: state.template,
      selection: state.selection,
      selectedIds: state.selectedIds,
    };
  }

  /** @param {Pick<StoreState, 'selection' | 'selectedIds'>} next */
  function commitSelection(next) {
    const same =
      next.selection === state.selection &&
      next.selectedIds.length === state.selectedIds.length &&
      next.selectedIds.every((id, i) => id === state.selectedIds[i]);
    if (same) return;
    lastMerge = null;
    commit({ ...state, ...next }, { type: 'select', id: next.selection, ids: next.selectedIds });
  }

  return {
    getState: () => state,

    dispatch(command) {
      if (command.type === 'loadTemplate') {
        past = [];
        future = [];
        lastMerge = null;
        commit({ template: command.template, selection: null, selectedIds: NONE }, command);
        return true;
      }

      /** @type {Warning[]} */
      const warnings = [];
      const nextTemplate = applyCommand(state.template, command, warnings, { blocks: blocks() });
      if (nextTemplate === state.template) {
        if (warnings.length > 0) commit(state, command, warnings);
        return false;
      }

      const time = now();
      const merge =
        command.mergeKey !== undefined &&
        lastMerge !== null &&
        lastMerge.key === command.mergeKey &&
        time - lastMerge.time <= mergeWindow &&
        past.length > 0;

      if (!merge) {
        past.push(snapshot());
        if (past.length > historyLimit) past = past.slice(past.length - historyLimit);
      }
      future = [];
      lastMerge = command.mergeKey !== undefined ? { key: command.mergeKey, time } : null;

      commit({ template: nextTemplate, ...keepSelection(nextTemplate, state) }, command, warnings);
      return true;
    },

    select(id) {
      const ids = id === null ? [] : typeof id === 'string' ? [id] : id;
      commitSelection(selectionOf(state.template, ids));
    },

    toggleSelect(id) {
      const tpl = state.template;
      if (state.selectedIds.includes(id)) {
        const rest = state.selectedIds.filter((other) => other !== id);
        commitSelection(selectionOf(tpl, rest));
        return;
      }
      const kind = kindOf(tpl, id);
      const current = state.selection ? kindOf(tpl, state.selection) : null;
      const together = kind === current && (kind === 'row' || kind === 'block');
      commitSelection(selectionOf(tpl, together ? [...state.selectedIds, id] : [id], id));
    },

    undo() {
      const entry = past.pop();
      if (!entry) return false;
      future.push(snapshot());
      lastMerge = null;
      commit(
        { template: entry.template, ...keepSelection(entry.template, entry) },
        { type: 'undo' },
      );
      return true;
    },

    redo() {
      const entry = future.pop();
      if (!entry) return false;
      past.push(snapshot());
      lastMerge = null;
      commit(
        { template: entry.template, ...keepSelection(entry.template, entry) },
        { type: 'redo' },
      );
      return true;
    },

    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
