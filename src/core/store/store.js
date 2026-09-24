// エディタの状態を持つストア。
// - template: 履歴（Undo/Redo）の対象
// - selection: 選択中の要素 ID。UI 状態なので履歴の対象外（ただし Undo 時は当時の選択を復元する）
import { applyCommand } from './commands.js';
import { collectIds } from '../model/tree.js';

/** @import { Command } from './commands.js' */
/** @import { Warning } from '../model/schema.js' */
/** @import { Template } from '../model/types.js' */

/**
 * @typedef {Object} StoreState
 * @property {Template} template
 * @property {string | null} selection 選択中の行・カラム・ブロックの ID
 */

/**
 * ストアの変更を表す。`command` は dispatch したコマンド、または undo / redo / select
 * @typedef {Command | { type: 'undo' } | { type: 'redo' } | { type: 'select', id: string | null }} StoreAction
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
 */

/**
 * @typedef {Object} StoreOptions
 * @property {number} [historyLimit] 保持する履歴の上限（既定 100）
 * @property {number} [mergeWindow] mergeKey が同じコマンドをまとめる時間（ms、既定 500）
 * @property {() => number} [now] 現在時刻（テスト用）
 */

/**
 * @typedef {Object} Store
 * @property {() => StoreState} getState
 * @property {(command: Command) => boolean} dispatch テンプレートが変化したら true
 * @property {(id: string | null) => void} select
 * @property {() => boolean} undo 戻せたら true
 * @property {() => boolean} redo やり直せたら true
 * @property {() => boolean} canUndo
 * @property {() => boolean} canRedo
 * @property {(listener: StoreListener) => () => void} subscribe 解除関数を返す
 */

/**
 * @param {Template} template 正規化済みのテンプレート（外部データは先に migrate() を通す）
 * @param {StoreOptions} [options]
 * @returns {Store}
 */
export function createStore(template, options = {}) {
  const { historyLimit = 100, mergeWindow = 500, now = () => Date.now() } = options;

  /** @type {StoreState} */
  let state = { template, selection: null };
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
   * 選択中の要素がテンプレートから消えていたら選択を外す
   * @param {Template} tpl
   * @param {string | null} selection
   */
  function validSelection(tpl, selection) {
    return selection !== null && collectIds(tpl).has(selection) ? selection : null;
  }

  /** @returns {HistoryEntry} */
  function snapshot() {
    return { template: state.template, selection: state.selection };
  }

  return {
    getState: () => state,

    dispatch(command) {
      if (command.type === 'loadTemplate') {
        past = [];
        future = [];
        lastMerge = null;
        commit({ template: command.template, selection: null }, command);
        return true;
      }

      /** @type {Warning[]} */
      const warnings = [];
      const nextTemplate = applyCommand(state.template, command, warnings);
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

      commit(
        { template: nextTemplate, selection: validSelection(nextTemplate, state.selection) },
        command,
        warnings,
      );
      return true;
    },

    select(id) {
      const selection = id === null ? null : validSelection(state.template, id);
      if (selection === state.selection) return;
      lastMerge = null;
      commit({ ...state, selection }, { type: 'select', id: selection });
    },

    undo() {
      const entry = past.pop();
      if (!entry) return false;
      future.push(snapshot());
      lastMerge = null;
      commit(
        { template: entry.template, selection: validSelection(entry.template, entry.selection) },
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
        { template: entry.template, selection: validSelection(entry.template, entry.selection) },
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
