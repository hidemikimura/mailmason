import { beforeEach, describe, expect, it } from 'vitest';
import {
  MailmasonError,
  applyCommand,
  createBlock,
  createRow,
  migrate,
} from '../../src/core/index.js';
import { loadFixture } from './helpers.js';

/** @typedef {import('../../src/core/model/types.js').Template} Template */

/** @type {Template} */
let base;

beforeEach(() => {
  base = migrate(loadFixture('basic')).template;
});

/** @param {Template} t */
const rowIds = (t) => t.body.rows.map((r) => r.id);
/**
 * @param {Template} t
 * @param {number} r
 * @param {number} c
 */
const blockIds = (t, r, c) => t.body.rows[r].columns[c].blocks.map((b) => b.id);

describe('行のコマンド', () => {
  it('addRow は指定位置に空の行を追加する', () => {
    const next = applyCommand(base, { type: 'addRow', layout: '1:1', index: 1 });
    expect(next.body.rows).toHaveLength(5);
    expect(next.body.rows[1].layout).toBe('1:1');
    expect(next.body.rows[1].columns).toHaveLength(2);
  });

  it('addRow は位置省略で末尾に追加する', () => {
    const next = applyCommand(base, { type: 'addRow' });
    expect(next.body.rows[4].layout).toBe('1');
  });

  it('addRow はブロック入りの行を 1 手で追加できる', () => {
    const row = createRow('1', [[createBlock('text')]]);
    const next = applyCommand(base, { type: 'addRow', row, index: 0 });
    expect(next.body.rows[0]).toBe(row);
  });

  it('addRow は既存と ID が衝突する行を拒否する', () => {
    const row = { ...createRow('1'), id: 'r_header01' };
    expect(() => applyCommand(base, { type: 'addRow', row })).toThrow(
      expect.objectContaining({ code: 'duplicate-id' }),
    );
  });

  it('moveRow は行を並べ替える（index は取り除いた後の位置）', () => {
    const next = applyCommand(base, { type: 'moveRow', rowId: 'r_header01', index: 3 });
    expect(rowIds(next)).toEqual(['r_body0001', 'r_items001', 'r_footer01', 'r_header01']);
  });

  it('moveRow で位置が変わらなければ同じ参照を返す', () => {
    expect(applyCommand(base, { type: 'moveRow', rowId: 'r_body0001', index: 1 })).toBe(base);
  });

  it('duplicateRow は直後に新しい ID の複製を入れる', () => {
    const next = applyCommand(base, { type: 'duplicateRow', rowId: 'r_items001' });
    expect(next.body.rows).toHaveLength(5);
    expect(next.body.rows[3].id).not.toBe('r_items001');
    expect(next.body.rows[3].columns[0].blocks[0].values).toEqual(
      base.body.rows[2].columns[0].blocks[0].values,
    );
  });

  it('removeRow は行を削除する', () => {
    const next = applyCommand(base, { type: 'removeRow', rowId: 'r_items001' });
    expect(rowIds(next)).toEqual(['r_header01', 'r_body0001', 'r_footer01']);
  });

  it('存在しない ID は not-found', () => {
    expect(() => applyCommand(base, { type: 'removeRow', rowId: 'r_nothing' })).toThrow(
      expect.objectContaining({ code: 'not-found' }),
    );
  });

  it('setRowLayout で分割を増やすと空カラムを足す', () => {
    const next = applyCommand(base, { type: 'setRowLayout', rowId: 'r_body0001', layout: '1:1:1' });
    const row = next.body.rows[1];
    expect(row.columns).toHaveLength(3);
    expect(row.columns[0]).toBe(base.body.rows[1].columns[0]);
    expect(row.columns[2].blocks).toEqual([]);
  });

  it('setRowLayout で分割を減らすと、消えるカラムのブロックを最後のカラムへ移す', () => {
    const next = applyCommand(base, { type: 'setRowLayout', rowId: 'r_items001', layout: '1' });
    expect(next.body.rows[2].columns).toHaveLength(1);
    expect(blockIds(next, 2, 0)).toEqual(['b_item0001', 'b_item0002']);
  });

  it('setRowLayout で分割数が同じなら layout だけ変わる', () => {
    const next = applyCommand(base, { type: 'setRowLayout', rowId: 'r_items001', layout: '1:2' });
    expect(next.body.rows[2].layout).toBe('1:2');
    expect(next.body.rows[2].columns).toEqual(base.body.rows[2].columns);
  });

  it('updateRowSettings は部分更新し、不正な値は現在値のまま警告する', () => {
    /** @type {any[]} */
    const warnings = [];
    const next = applyCommand(
      base,
      {
        type: 'updateRowSettings',
        rowId: 'r_body0001',
        patch: { backgroundColor: '#FFEEDD', padding: { top: 40 }, columnGap: -1 },
      },
      warnings,
    );
    const settings = next.body.rows[1].settings;
    expect(settings.backgroundColor).toBe('#ffeedd');
    expect(settings.padding).toEqual({ top: 40, right: 24, bottom: 8, left: 24 });
    expect(settings.columnGap).toBe(16);
    expect(warnings).toMatchObject([{ code: 'invalid-value' }]);
  });

  it('値が変わらない更新は同じ参照を返す', () => {
    const next = applyCommand(base, {
      type: 'updateRowSettings',
      rowId: 'r_body0001',
      patch: { columnGap: 16 },
    });
    expect(next).toBe(base);
  });
});

describe('カラム・ボディのコマンド', () => {
  it('updateColumnSettings', () => {
    const next = applyCommand(base, {
      type: 'updateColumnSettings',
      columnId: 'c_items002',
      patch: { verticalAlign: 'middle' },
    });
    expect(next.body.rows[2].columns[1].settings.verticalAlign).toBe('middle');
  });

  it('updateBodySettings', () => {
    const next = applyCommand(base, { type: 'updateBodySettings', patch: { width: 640 } });
    expect(next.body.settings.width).toBe(640);
    expect(next.body.rows).toBe(base.body.rows);
  });
});

describe('ブロックのコマンド', () => {
  it('addBlock は blockType と values から作って追加する', () => {
    const next = applyCommand(base, {
      type: 'addBlock',
      columnId: 'c_body0001',
      index: 1,
      blockType: 'spacer',
      values: { height: 40 },
    });
    const added = next.body.rows[1].columns[0].blocks[1];
    expect(added.type).toBe('spacer');
    expect(added.values.height).toBe(40);
  });

  it('addBlock は作成済みのブロックも受け取れる', () => {
    const block = createBlock('divider');
    const next = applyCommand(base, { type: 'addBlock', columnId: 'c_items002', block });
    expect(blockIds(next, 2, 1)).toEqual(['b_item0002', block.id]);
  });

  it('addBlock は block も blockType も無ければ invalid-command', () => {
    expect(() => applyCommand(base, { type: 'addBlock', columnId: 'c_items002' })).toThrow(
      expect.objectContaining({ code: 'invalid-command' }),
    );
  });

  it('moveBlock は同じカラム内で並べ替える', () => {
    const next = applyCommand(base, {
      type: 'moveBlock',
      blockId: 'b_text0002',
      columnId: 'c_footer01',
      index: 0,
    });
    expect(blockIds(next, 3, 0)).toEqual(['b_text0002', 'b_divide01', 'b_social01', 'b_space001']);
  });

  it('moveBlock は別の行のカラムへ移す', () => {
    const next = applyCommand(base, {
      type: 'moveBlock',
      blockId: 'b_button01',
      columnId: 'c_items002',
      index: 0,
    });
    expect(blockIds(next, 1, 0)).toEqual(['b_text0001']);
    expect(blockIds(next, 2, 1)).toEqual(['b_button01', 'b_item0002']);
  });

  it('moveBlock は同じ行の別カラムへ移す', () => {
    const next = applyCommand(base, {
      type: 'moveBlock',
      blockId: 'b_item0001',
      columnId: 'c_items002',
      index: 1,
    });
    expect(blockIds(next, 2, 0)).toEqual([]);
    expect(blockIds(next, 2, 1)).toEqual(['b_item0002', 'b_item0001']);
  });

  it('moveBlock で位置が変わらなければ同じ参照を返す', () => {
    expect(
      applyCommand(base, {
        type: 'moveBlock',
        blockId: 'b_button01',
        columnId: 'c_body0001',
        index: 1,
      }),
    ).toBe(base);
  });

  it('moveBlockToNewRow はブロックを新しい 1 カラム行に移して指定位置に入れる', () => {
    const next = applyCommand(base, { type: 'moveBlockToNewRow', blockId: 'b_button01', index: 0 });
    expect(next.body.rows).toHaveLength(5);
    expect(next.body.rows[0].layout).toBe('1');
    expect(next.body.rows[0].columns[0].blocks.map((b) => b.id)).toEqual(['b_button01']);
    expect(blockIds(next, 2, 0)).toEqual(['b_text0001']);
  });

  it('duplicateBlock は直後に複製を入れる', () => {
    const next = applyCommand(base, { type: 'duplicateBlock', blockId: 'b_text0001' });
    const blocks = next.body.rows[1].columns[0].blocks;
    expect(blocks).toHaveLength(3);
    expect(blocks[1].id).not.toBe('b_text0001');
    expect(blocks[1].values).toEqual(blocks[0].values);
  });

  it('removeBlock', () => {
    const next = applyCommand(base, { type: 'removeBlock', blockId: 'b_social01' });
    expect(blockIds(next, 3, 0)).toEqual(['b_divide01', 'b_space001', 'b_text0002']);
  });

  it('updateBlockValues は values に深くマージする', () => {
    const next = applyCommand(base, {
      type: 'updateBlockValues',
      blockId: 'b_item0001',
      patch: { image: { alt: '新しい代替テキスト' } },
    });
    const values = /** @type {any} */ (next.body.rows[2].columns[0].blocks[0].values);
    expect(values.image.alt).toBe('新しい代替テキスト');
    expect(values.image.src).toBe('https://example.com/images/item1.png');
  });

  it('updateBlockValues は配列を置き換える', () => {
    const next = applyCommand(base, {
      type: 'updateBlockValues',
      blockId: 'b_social01',
      patch: { items: [{ service: 'line', url: 'https://line.me/x' }] },
    });
    expect(next.body.rows[3].columns[0].blocks[1].values.items).toEqual([
      { service: 'line', url: 'https://line.me/x' },
    ]);
  });

  it('updateBlockValues は未知のブロックを編集できない', () => {
    const input = loadFixture('basic');
    input.body.rows[0].columns[0].blocks.push({
      id: 'b_countdown1',
      type: 'countdown',
      values: {},
    });
    const template = migrate(input).template;
    expect(() =>
      applyCommand(template, { type: 'updateBlockValues', blockId: 'b_countdown1', patch: {} }),
    ).toThrow(expect.objectContaining({ code: 'unknown-block-type' }));
  });

  it('updateBlockStyle と setBlockHideOn', () => {
    let next = applyCommand(base, {
      type: 'updateBlockStyle',
      blockId: 'b_text0001',
      patch: { backgroundColor: '#eeeeee' },
    });
    next = applyCommand(next, { type: 'setBlockHideOn', blockId: 'b_text0001', hideOn: 'mobile' });
    const block = next.body.rows[1].columns[0].blocks[0];
    expect(block.style.backgroundColor).toBe('#eeeeee');
    expect(block.hideOn).toBe('mobile');
  });
});

describe('テキストパートのコマンド', () => {
  it('setTextPart で manual になり、resetTextPart で auto に戻る', () => {
    const manual = applyCommand(base, {
      type: 'setTextPart',
      content: '手編集',
      sourceHash: 'abc',
    });
    expect(manual.text).toEqual({ mode: 'manual', content: '手編集', sourceHash: 'abc' });
    const auto = applyCommand(manual, { type: 'resetTextPart' });
    expect(auto.text).toEqual({ mode: 'auto', content: null, sourceHash: null });
    expect(applyCommand(auto, { type: 'resetTextPart' })).toBe(auto);
  });

  it('setTextPart は sourceHash 省略時に以前の値を保つ', () => {
    let next = applyCommand(base, { type: 'setTextPart', content: 'a', sourceHash: 'h1' });
    next = applyCommand(next, { type: 'setTextPart', content: 'ab' });
    expect(next.text.sourceHash).toBe('h1');
  });
});

describe('イミュータブル更新', () => {
  it('変更していない行・カラム・ブロックは参照を共有する', () => {
    const next = applyCommand(base, {
      type: 'updateBlockValues',
      blockId: 'b_button01',
      patch: { label: '今すぐ見る' },
    });
    expect(next).not.toBe(base);
    expect(next.body.rows[0]).toBe(base.body.rows[0]);
    expect(next.body.rows[2]).toBe(base.body.rows[2]);
    expect(next.body.rows[1].columns[0].blocks[0]).toBe(base.body.rows[1].columns[0].blocks[0]);
    expect(base.body.rows[1].columns[0].blocks[1].values.label).toBe('新作を見る');
  });

  it('未知のコマンドは unknown-command', () => {
    expect(() => applyCommand(base, /** @type {any} */ ({ type: 'explode' }))).toThrow(
      MailmasonError,
    );
  });
});
