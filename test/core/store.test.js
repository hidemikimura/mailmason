import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, createTemplate, migrate } from '../../src/core/index.js';
import { loadFixture } from './helpers.js';

/** @typedef {import('../../src/core/store/store.js').Store} Store */

let time = 0;
/** @type {Store} */
let store;

beforeEach(() => {
  time = 0;
  store = createStore(migrate(loadFixture('basic')).template, { now: () => time });
});

/** @param {string} label */
const setLabel = (label, mergeKey = 'b_button01.label') =>
  store.dispatch({ type: 'updateBlockValues', blockId: 'b_button01', patch: { label }, mergeKey });

const label = () => store.getState().template.body.rows[1].columns[0].blocks[1].values.label;

describe('createStore', () => {
  it('dispatch でテンプレートが変わり、Undo / Redo できる', () => {
    const original = store.getState().template;
    expect(store.dispatch({ type: 'removeRow', rowId: 'r_header01' })).toBe(true);
    expect(store.getState().template.body.rows).toHaveLength(3);
    expect(store.canUndo()).toBe(true);

    expect(store.undo()).toBe(true);
    expect(store.getState().template).toBe(original);
    expect(store.canRedo()).toBe(true);

    expect(store.redo()).toBe(true);
    expect(store.getState().template.body.rows).toHaveLength(3);
  });

  it('変化しないコマンドは履歴に積まない', () => {
    expect(store.dispatch({ type: 'moveRow', rowId: 'r_header01', index: 0 })).toBe(false);
    expect(store.canUndo()).toBe(false);
  });

  it('新しい操作をすると Redo 履歴は消える', () => {
    store.dispatch({ type: 'removeRow', rowId: 'r_header01' });
    store.undo();
    store.dispatch({ type: 'removeRow', rowId: 'r_footer01' });
    expect(store.canRedo()).toBe(false);
  });

  it('同じ mergeKey の連続操作は時間内なら 1 つの履歴にまとめる', () => {
    setLabel('新');
    time = 200;
    setLabel('新作');
    time = 400;
    setLabel('新作！');
    expect(label()).toBe('新作！');
    store.undo();
    expect(label()).toBe('新作を見る');
    expect(store.canUndo()).toBe(false);
  });

  it('時間が空いたら別の履歴にする', () => {
    setLabel('A');
    time = 1000;
    setLabel('B');
    store.undo();
    expect(label()).toBe('A');
  });

  it('mergeKey が違えば別の履歴にする', () => {
    setLabel('A', 'k1');
    setLabel('B', 'k2');
    store.undo();
    expect(label()).toBe('A');
  });

  it('Undo の後はまとめない', () => {
    setLabel('A');
    store.undo();
    setLabel('B');
    setLabel('C');
    store.undo();
    expect(label()).toBe('新作を見る');
  });

  it('履歴は上限を超えたら古いものから捨てる', () => {
    store = createStore(createTemplate(), { historyLimit: 3 });
    for (let i = 0; i < 5; i++) store.dispatch({ type: 'addRow' });
    let undos = 0;
    while (store.undo()) undos++;
    expect(undos).toBe(3);
    expect(store.getState().template.body.rows).toHaveLength(2);
  });

  it('削除された要素の選択は外し、Undo で当時の選択を戻す', () => {
    store.select('b_button01');
    store.dispatch({ type: 'removeBlock', blockId: 'b_button01' });
    expect(store.getState().selection).toBeNull();
    store.undo();
    expect(store.getState().selection).toBe('b_button01');
  });

  it('存在しない ID は選択できない', () => {
    store.select('b_nothing');
    expect(store.getState().selection).toBeNull();
  });

  it('loadTemplate は履歴と選択をクリアする', () => {
    store.select('b_button01');
    store.dispatch({ type: 'removeRow', rowId: 'r_header01' });
    store.dispatch({ type: 'loadTemplate', template: createTemplate() });
    expect(store.canUndo()).toBe(false);
    expect(store.getState().selection).toBeNull();
    expect(store.getState().template.body.rows).toEqual([]);
  });

  it('購読者に変更後・変更前の状態とアクションを通知し、解除できる', () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.dispatch({ type: 'removeRow', rowId: 'r_header01' });
    store.select('b_button01');
    store.undo();
    expect(listener.mock.calls.map((call) => call[2].type)).toEqual([
      'removeRow',
      'select',
      'undo',
    ]);
    const [state, prev] = listener.mock.calls[0];
    expect(prev.template.body.rows).toHaveLength(4);
    expect(state.template.body.rows).toHaveLength(3);

    unsubscribe();
    store.redo();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('不正なパッチは変化なしでも警告を通知する', () => {
    const listener = vi.fn();
    store.subscribe(listener);
    const changed = store.dispatch({
      type: 'updateRowSettings',
      rowId: 'r_body0001',
      patch: { backgroundColor: 'red' },
    });
    expect(changed).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][3]).toMatchObject([{ code: 'invalid-value' }]);
  });
});
