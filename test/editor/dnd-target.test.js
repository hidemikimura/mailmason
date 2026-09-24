import { describe, expect, it } from 'vitest';
import { ROW_EDGE, findDropTarget } from '../../src/editor/dnd/target.js';

/** @typedef {import('../../src/editor/dnd/target.js').Geometry} Geometry */

/**
 * 600px 幅のメールに 2 行: 行 0 は 1 カラム（ブロック 2 つ）、行 1 は 2 カラム（左にブロック 1 つ、右は空）
 * @returns {Geometry}
 */
function geometry() {
  const box = (left, top, right, bottom) => ({ left, top, right, bottom });
  return {
    mail: box(100, 0, 700, 400),
    rows: [
      {
        id: 'r0',
        index: 0,
        box: box(100, 0, 700, 200),
        columns: [
          {
            id: 'c0',
            rowId: 'r0',
            box: box(100, 0, 700, 200),
            blocks: [
              { id: 'b0', box: box(100, 20, 700, 100) },
              { id: 'b1', box: box(100, 100, 700, 180) },
            ],
          },
        ],
      },
      {
        id: 'r1',
        index: 1,
        box: box(100, 200, 700, 400),
        columns: [
          {
            id: 'c1',
            rowId: 'r1',
            box: box(100, 200, 400, 400),
            blocks: [{ id: 'b2', box: box(100, 220, 400, 380) }],
          },
          { id: 'c2', rowId: 'r1', box: box(400, 200, 700, 400), blocks: [] },
        ],
      },
    ],
  };
}

const newText = /** @type {const} */ ({ kind: 'new-block', type: 'text' });

describe('findDropTarget（ブロック）', () => {
  it('ブロックの中点より上なら前、下なら後ろに入れる', () => {
    expect(findDropTarget(geometry(), newText, 300, 50).target).toEqual({
      kind: 'column',
      columnId: 'c0',
      index: 0,
    });
    expect(findDropTarget(geometry(), newText, 300, 90).target).toEqual({
      kind: 'column',
      columnId: 'c0',
      index: 1,
    });
    expect(findDropTarget(geometry(), newText, 300, 170).target).toEqual({
      kind: 'column',
      columnId: 'c0',
      index: 2,
    });
  });

  it('挿入線は前のブロックの下端に引く', () => {
    const { indicator } = findDropTarget(geometry(), newText, 300, 90);
    expect(indicator).toEqual({ type: 'line', left: 100, top: 100, width: 600, height: 0 });
  });

  it('x に対応するカラムを選び、空のカラムは枠で示す', () => {
    const hit = findDropTarget(geometry(), newText, 550, 300);
    expect(hit.target).toEqual({ kind: 'column', columnId: 'c2', index: 0 });
    expect(hit.indicator).toEqual({ type: 'box', left: 400, top: 200, width: 300, height: 200 });
  });

  it('メールの外側でも最も近いカラムにする', () => {
    expect(findDropTarget(geometry(), newText, 20, 300).target).toMatchObject({ columnId: 'c1' });
  });

  it('行の上下端の近くなら行間（新しい行）にする', () => {
    expect(findDropTarget(geometry(), newText, 300, 200 + ROW_EDGE - 1).target).toEqual({
      kind: 'rowGap',
      index: 1,
    });
    expect(findDropTarget(geometry(), newText, 300, 200 - ROW_EDGE + 1).target).toEqual({
      kind: 'rowGap',
      index: 1,
    });
  });

  it('全行より下なら末尾の行間、行が無ければ先頭', () => {
    expect(findDropTarget(geometry(), newText, 300, 450).target).toEqual({
      kind: 'rowGap',
      index: 2,
    });
    expect(findDropTarget({ ...geometry(), rows: [] }, newText, 300, 50).target).toEqual({
      kind: 'rowGap',
      index: 0,
    });
  });

  it('移動中のブロック自身は位置の計算から除く（取り除いた後の index になる）', () => {
    const move = /** @type {const} */ ({ kind: 'move-block', blockId: 'b0' });
    expect(findDropTarget(geometry(), move, 300, 170).target).toEqual({
      kind: 'column',
      columnId: 'c0',
      index: 1,
    });
  });
});

describe('findDropTarget（行）', () => {
  it('行の中点で前後を決め、行間だけを落とし先にする', () => {
    const row = /** @type {const} */ ({ kind: 'new-row', layout: '1:1' });
    expect(findDropTarget(geometry(), row, 300, 50).target).toEqual({ kind: 'rowGap', index: 0 });
    expect(findDropTarget(geometry(), row, 300, 150).target).toEqual({ kind: 'rowGap', index: 1 });
    expect(findDropTarget(geometry(), row, 300, 350).target).toEqual({ kind: 'rowGap', index: 2 });
  });

  it('移動中の行は除いて数える', () => {
    const move = /** @type {const} */ ({ kind: 'move-row', rowId: 'r0' });
    expect(findDropTarget(geometry(), move, 300, 350).target).toEqual({ kind: 'rowGap', index: 1 });
    const { indicator } = findDropTarget(geometry(), move, 300, 350);
    expect(indicator.top).toBe(400);
  });
});
