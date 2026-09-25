// 複数選択（ストア）・まとめてのコマンド（batch）・コピー＆貼り付けの計算
import { beforeEach, describe, expect, it } from 'vitest';
import { applyCommand, createStore, migrate } from '../../src/core/index.js';
import {
  CLIPBOARD_TYPE,
  createPayload,
  duplicateCommands,
  instantiatePayload,
  parsePayload,
  pasteCommands,
  removeCommands,
} from '../../src/editor/clipboard.js';
import { loadFixture } from './helpers.js';

// basic フィクスチャ:
//   r_header01 [b_banner01]
//   r_body0001 [b_text0001, b_button01]
//   r_items001 [b_item0001] [b_item0002]
//   r_footer01 [b_divide01, b_social01, b_space001, b_text0002]

/** @type {import('../../src/core/store/store.js').Store} */
let store;

beforeEach(() => {
  store = createStore(migrate(loadFixture('basic')).template);
});

const state = () => store.getState();

describe('複数選択（ストア）', () => {
  it('toggleSelect で同じ種類を足し、もう一度で外す。種類が違えば選び直す', () => {
    store.select('b_text0001');
    store.toggleSelect('b_item0002');
    expect(state().selectedIds).toEqual(['b_text0001', 'b_item0002']);
    expect(state().selection).toBe('b_item0002');

    store.toggleSelect('b_item0002');
    expect(state().selectedIds).toEqual(['b_text0001']);
    expect(state().selection).toBe('b_text0001');

    // 行を足そうとすると、行だけを選び直す
    store.toggleSelect('r_footer01');
    expect(state().selectedIds).toEqual(['r_footer01']);
    store.toggleSelect('r_header01');
    expect(state().selectedIds).toEqual(['r_footer01', 'r_header01']);

    // カラムはまとめて選べない
    store.toggleSelect('c_items001');
    expect(state().selectedIds).toEqual(['c_items001']);
    store.toggleSelect('c_items002');
    expect(state().selectedIds).toEqual(['c_items002']);

    store.toggleSelect('c_items002');
    expect(state().selection).toBeNull();
    expect(state().selectedIds).toEqual([]);
  });

  it('select に配列を渡すとまとめて選ぶ（無い ID と種類の違うものは除く）', () => {
    store.select(['b_text0001', 'x_missing', 'r_body0001', 'b_button01']);
    expect(state().selectedIds).toEqual(['b_text0001', 'b_button01']);
    expect(state().selection).toBe('b_button01');
    store.select('b_text0001');
    expect(state().selectedIds).toEqual(['b_text0001']);
    store.select(null);
    expect(state().selectedIds).toEqual([]);
  });

  it('消えた要素は選択から外し、Undo でまとめて選んでいた状態に戻す', () => {
    store.select(['b_text0001', 'b_button01']);
    store.dispatch({ type: 'removeBlock', blockId: 'b_button01' });
    expect(state().selectedIds).toEqual(['b_text0001']);
    expect(state().selection).toBe('b_text0001');
    store.undo();
    expect(state().selectedIds).toEqual(['b_text0001', 'b_button01']);
  });

  it('select の通知に ids を含める', () => {
    /** @type {any[]} */
    const actions = [];
    store.subscribe((_s, _p, action) => actions.push(action));
    store.select('b_text0001');
    store.toggleSelect('b_button01');
    expect(actions).toEqual([
      { type: 'select', id: 'b_text0001', ids: ['b_text0001'] },
      { type: 'select', id: 'b_button01', ids: ['b_text0001', 'b_button01'] },
    ]);
  });
});

describe('batch コマンド', () => {
  it('順に適用し、1 つの履歴にする', () => {
    store.dispatch({
      type: 'batch',
      commands: [
        { type: 'removeBlock', blockId: 'b_text0001' },
        { type: 'removeRow', rowId: 'r_header01' },
      ],
    });
    const rows = state().template.body.rows;
    expect(rows.map((r) => r.id)).toEqual(['r_body0001', 'r_items001', 'r_footer01']);
    expect(rows[0].columns[0].blocks.map((b) => b.id)).toEqual(['b_button01']);
    store.undo();
    expect(state().template.body.rows).toHaveLength(4);
    expect(store.canUndo()).toBe(false);
  });

  it('途中で失敗したら何も変えない。loadTemplate は入れられない', () => {
    const before = state().template;
    expect(() =>
      applyCommand(before, {
        type: 'batch',
        commands: [
          { type: 'removeRow', rowId: 'r_header01' },
          { type: 'removeRow', rowId: 'r_missing' },
        ],
      }),
    ).toThrow();
    expect(state().template).toBe(before);
    expect(() =>
      applyCommand(before, {
        type: 'batch',
        commands: [{ type: 'loadTemplate', template: before }],
      }),
    ).toThrow(/batch/);
  });
});

describe('コピー＆貼り付けの計算', () => {
  it('選んだ順ではなく、テンプレートでの順に並べる。行を含むときは行だけ', () => {
    const tpl = state().template;
    const blocks = createPayload(tpl, ['b_text0002', 'b_text0001']);
    expect(blocks?.kind).toBe('blocks');
    expect(blocks?.items.map((b) => /** @type {any} */ (b).id)).toEqual([
      'b_text0001',
      'b_text0002',
    ]);
    const rows = createPayload(tpl, ['r_footer01', 'r_header01']);
    expect(rows?.kind).toBe('rows');
    expect(rows?.items.map((r) => /** @type {any} */ (r).id)).toEqual(['r_header01', 'r_footer01']);
    expect(createPayload(tpl, ['c_items001'])).toBeNull();
    expect(createPayload(tpl, [])).toBeNull();
  });

  it('クリップボードの文字列を読む（Mailmason の形でなければ null）', () => {
    const payload = createPayload(state().template, ['b_button01']);
    expect(parsePayload(JSON.stringify(payload))).toEqual(payload);
    expect(parsePayload('ただの文章')).toBeNull();
    expect(parsePayload('{"mailmason":"other","kind":"blocks","items":[{}]}')).toBeNull();
    expect(parsePayload('{"mailmason":"clipboard","kind":"blocks","items":[]}')).toBeNull();
    expect(parsePayload('{broken')).toBeNull();
    expect(CLIPBOARD_TYPE).toBe('application/x-mailmason+json');
  });

  it('貼り付け: ID を振り直し、選んだブロックの後ろに順に入れる', () => {
    const tpl = state().template;
    const payload = /** @type {any} */ (createPayload(tpl, ['b_text0001', 'b_button01']));
    const items = instantiatePayload(payload);
    expect(items.blocks.map((b) => b.type)).toEqual(['text', 'button']);
    expect(items.blocks.map((b) => b.id)).not.toContain('b_text0001');

    const { commands, ids } = pasteCommands(tpl, 'b_divide01', items);
    const next = applyCommand(tpl, { type: 'batch', commands });
    expect(next.body.rows[3].columns[0].blocks.map((b) => b.id)).toEqual([
      'b_divide01',
      ...ids,
      'b_social01',
      'b_space001',
      'b_text0002',
    ]);
  });

  it('貼り付けの位置: カラムの末尾・行の最初のカラム・何も選んでいなければ新しい行。行は選んだ要素の行の後ろ', () => {
    const tpl = state().template;
    const blockPayload = /** @type {any} */ (createPayload(tpl, ['b_button01']));
    /** @param {string | null} selection */
    const pasteBlocks = (selection) => {
      const items = instantiatePayload(blockPayload);
      return applyCommand(tpl, {
        type: 'batch',
        commands: pasteCommands(tpl, selection, items).commands,
      });
    };
    expect(pasteBlocks('c_items002').body.rows[2].columns[1].blocks.map((b) => b.type)).toEqual([
      'imageText',
      'button',
    ]);
    expect(pasteBlocks('r_items001').body.rows[2].columns[0].blocks.map((b) => b.type)).toEqual([
      'imageText',
      'button',
    ]);
    const appended = pasteBlocks(null).body.rows;
    expect(appended).toHaveLength(5);
    expect(appended[4].columns[0].blocks.map((b) => b.type)).toEqual(['button']);

    const rowPayload = /** @type {any} */ (createPayload(tpl, ['r_header01', 'r_items001']));
    const items = instantiatePayload(rowPayload);
    const { commands, ids } = pasteCommands(tpl, 'b_text0001', items);
    const next = applyCommand(tpl, { type: 'batch', commands });
    expect(next.body.rows.map((r) => r.id)).toEqual([
      'r_header01',
      'r_body0001',
      ...ids,
      'r_items001',
      'r_footer01',
    ]);
  });

  it('壊れた項目は除いて警告にする（定義の無いカスタムブロックは読み込み時と同じく残す）', () => {
    const items = instantiatePayload({
      mailmason: 'clipboard',
      version: 1,
      kind: 'blocks',
      items: [
        /** @type {any} */ ({ broken: true }),
        /** @type {any} */ ({ id: 'b_x', type: 'acme-coupon', values: { code: 'A1' } }),
        /** @type {any} */ ({ id: 'b_y', type: 'spacer', values: { height: 20 } }),
      ],
    });
    expect(items.blocks.map((b) => b.type)).toEqual(['acme-coupon', 'spacer']);
    expect(items.warnings.map((w) => w.path)).toContain('clipboard[0]');
  });

  it('まとめて複製: それぞれの直後に入れ、複製の ID を上から順に返す。まとめて削除', () => {
    const tpl = state().template;
    const { commands, ids } = duplicateCommands(tpl, ['b_text0002', 'b_divide01', 'r_header01']);
    const next = applyCommand(tpl, { type: 'batch', commands });
    expect(next.body.rows).toHaveLength(5);
    expect(next.body.rows[1].id).toBe(ids[0]);
    const footer = next.body.rows[4].columns[0].blocks.map((b) => b.id);
    expect(footer).toEqual([
      'b_divide01',
      ids[1],
      'b_social01',
      'b_space001',
      'b_text0002',
      ids[2],
    ]);

    const removed = applyCommand(tpl, {
      type: 'batch',
      commands: removeCommands(tpl, ['b_text0001', 'r_header01', 'c_items001']),
    });
    expect(removed.body.rows.map((r) => r.id)).toEqual(['r_body0001', 'r_items001', 'r_footer01']);
    expect(removed.body.rows[0].columns[0].blocks.map((b) => b.id)).toEqual(['b_button01']);
  });
});
