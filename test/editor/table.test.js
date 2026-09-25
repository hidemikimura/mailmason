// 表の直接編集: セルの結合・行と列の並べ替え・スマホの縦並びの設定
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasBlocks, deep, fixtures, frame, mount, press } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

// tables フィクスチャの表（6 行 × 4 列、1 行目が見出し）
//   0: プラン       | 期間 | 料金     | 特典
//   1: ライト（縦 2）| 月額 | 500円    | 初月無料（縦 2）
//   2:              | 年額 | 5,000円  |
//   3: スタンダード（縦 2）| 月額 | 1,000円 | 2 か月無料（縦 2）
//   4:              | 年額 | 10,000円 |
//   5: 注記         | 料金はすべて税込です。…（横 3）
const TABLE_INDEX = 2;

/** @param {MailmasonEditor} el */
const values = (el) => /** @type {any} */ (el.getJson().body.rows[0].columns[0].blocks[2].values);

/**
 * 出力 HTML の表のセル（行と、その行で表示しているセルの順番）をダブルクリックして編集を始める
 * @param {number} row
 * @param {number} index
 */
async function editTable(row = 1, index = 1) {
  const el = await mount();
  el.loadJson(fixtures.tables);
  await frame();
  const block = /** @type {any} */ (canvasBlocks(el)[TABLE_INDEX]);
  const cell = block.shadowRoot.querySelector('table.mm-table').rows[row].cells[index];
  cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await frame();
  await frame();
  const tableEditor = /** @type {any} */ (block.shadowRoot.querySelector('mm-table-editor'));
  await tableEditor.updateComplete;
  return { el, block, tableEditor };
}

/** @param {any} tableEditor */
async function active(tableEditor) {
  await tableEditor.updateComplete;
  const editor = tableEditor.shadowRoot.querySelector('mm-text-editor');
  await editor.updateComplete;
  const cell = /** @type {HTMLElement} */ (editor.closest('td, th'));
  return {
    cell,
    at: [Number(cell.dataset.row), Number(cell.dataset.column)],
    editable: /** @type {HTMLElement} */ (editor.shadowRoot.querySelector('.editable')),
  };
}

/**
 * @param {any} tableEditor
 * @param {number} row
 * @param {number} column
 * @param {boolean} [shiftKey]
 */
async function pointCell(tableEditor, row, column, shiftKey = false) {
  const cell = tableEditor.shadowRoot.querySelector(`[data-row="${row}"][data-column="${column}"]`);
  cell.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true, cancelable: true, shiftKey }),
  );
  await tableEditor.updateComplete;
}

/**
 * @param {any} tableEditor
 * @param {string} name
 */
const op = (tableEditor, name) =>
  /** @type {HTMLButtonElement} */ (tableEditor.shadowRoot.querySelector(`[data-op="${name}"]`));

describe('表: セルの結合', () => {
  it('結合したセルを colspan・rowspan で表示し、覆われたセルは出さない', async () => {
    // 3 行目の最初のセルは、結合に覆われない最初の列（年額）
    const { tableEditor } = await editTable(2, 0);
    const { at, editable } = await active(tableEditor);
    expect(at).toEqual([2, 1]);
    expect(editable.innerHTML).toBe('年額');
    const root = tableEditor.shadowRoot;
    expect(root.querySelectorAll('td, th')).toHaveLength(24 - 4 - 2);
    expect(root.querySelector('[data-row="1"][data-column="0"]').rowSpan).toBe(2);
    expect(root.querySelector('[data-row="5"][data-column="1"]').colSpan).toBe(3);
    expect(root.querySelector('[data-row="2"][data-column="0"]')).toBeNull();
  });

  it('Tab は覆われたセルを飛ばす', async () => {
    const { tableEditor } = await editTable(1, 3); // 初月無料
    let { at, editable } = await active(tableEditor);
    expect(at).toEqual([1, 3]);
    press(editable, 'Tab');
    ({ at, editable } = await active(tableEditor));
    expect(at).toEqual([2, 1]);
    press(editable, 'Tab', { shiftKey: true });
    ({ at } = await active(tableEditor));
    expect(at).toEqual([1, 3]);
  });

  it('Shift+クリックで範囲を選んで結合し、値は改行でつなぐ。解除もできる', async () => {
    const { el, tableEditor } = await editTable(1, 1); // 月額
    expect(op(tableEditor, 'merge').disabled).toBe(true);
    expect(op(tableEditor, 'unmerge').disabled).toBe(true);
    await pointCell(tableEditor, 2, 2, true);
    const selected = tableEditor.shadowRoot.querySelectorAll('.selected');
    expect(selected).toHaveLength(4);
    // 編集中のセルは変わらない
    expect((await active(tableEditor)).at).toEqual([1, 1]);
    expect(op(tableEditor, 'merge').disabled).toBe(false);

    op(tableEditor, 'merge').click();
    await frame();
    expect(values(el).merges).toContainEqual({ row: 1, column: 1, rowSpan: 2, colSpan: 2 });
    expect(values(el).cells[1][1]).toBe('月額<br>500円<br>年額<br>5,000円');
    expect(values(el).cells[2][2]).toBe('');
    const { at, cell } = await active(tableEditor);
    expect(at).toEqual([1, 1]);
    expect(/** @type {HTMLTableCellElement} */ (cell).colSpan).toBe(2);
    expect(tableEditor.shadowRoot.querySelectorAll('.selected')).toHaveLength(0);
    expect(op(tableEditor, 'unmerge').disabled).toBe(false);

    op(tableEditor, 'unmerge').click();
    await frame();
    expect(values(el).merges).not.toContainEqual({ row: 1, column: 1, rowSpan: 2, colSpan: 2 });
    el.undo();
    el.undo();
    await frame();
    expect(values(el).cells).toEqual(
      fixtures.tables.body.rows[0].columns[0].blocks[2].values.cells,
    );
  });

  it('結合したセルにかかる範囲は、結合を含むまで広げる', async () => {
    const { tableEditor } = await editTable(1, 1); // 月額
    await pointCell(tableEditor, 1, 0, true); // ライト（縦 2）
    expect(tableEditor.range).toEqual({ row: 1, column: 0, rowSpan: 2, colSpan: 2 });
    // Shift なしで押すと範囲を解く
    await pointCell(tableEditor, 3, 1);
    expect(tableEditor.shadowRoot.querySelectorAll('.selected')).toHaveLength(0);
  });
});

describe('表: 行と列の並べ替え', () => {
  it('ボタンで行を上下に移す。縦に結合した行はまとめて動き、編集中のセルもついていく', async () => {
    const { el, tableEditor } = await editTable(3, 1); // スタンダードの月額
    expect(op(tableEditor, 'move-row-down').disabled).toBe(false);
    op(tableEditor, 'move-row-up').click();
    await frame();
    expect(values(el).cells.map((/** @type {string[]} */ row) => row[0])).toEqual([
      'プラン',
      'スタンダード',
      '',
      'ライト',
      '',
      '注記',
    ]);
    expect(values(el).merges.slice(0, 2)).toEqual([
      { row: 1, column: 0, rowSpan: 2, colSpan: 1 },
      { row: 1, column: 3, rowSpan: 2, colSpan: 1 },
    ]);
    const { at, editable } = await active(tableEditor);
    expect(at).toEqual([1, 1]);
    expect(editable.innerHTML).toBe('月額');

    // 見出しの上には動かせるが、先頭の行はそれ以上上に動かない
    op(tableEditor, 'move-row-up').click();
    await frame();
    expect(values(el).cells[0][1]).toBe('月額');
    expect(op(tableEditor, 'move-row-up').disabled).toBe(true);
  });

  it('ボタンで列を左右に移す。列の幅と揃えもいっしょに動き、横に結合した列はまとめて動く', async () => {
    const { el, tableEditor } = await editTable(0, 0); // プラン
    expect(op(tableEditor, 'move-column-left').disabled).toBe(true);
    op(tableEditor, 'move-column-right').click();
    await frame();
    // 最後の行で右 3 列を横に結合しているので、プランは 3 列を飛び越える
    expect(values(el).cells[0]).toEqual(['期間', '料金', '特典', 'プラン']);
    expect(values(el).columns.map((/** @type {any} */ c) => c.align)).toEqual([
      'center',
      'right',
      'left',
      'left',
    ]);
    expect(values(el).columns[3].width).toBe(28);
    expect(values(el).merges).toContainEqual({ row: 5, column: 0, rowSpan: 1, colSpan: 3 });
    expect((await active(tableEditor)).at).toEqual([0, 3]);
    expect(op(tableEditor, 'move-column-right').disabled).toBe(true);
    // 3 列のどれを選んでもまとめて動く
    await pointCell(tableEditor, 0, 1);
    op(tableEditor, 'move-column-right').click();
    await frame();
    expect(values(el).cells[0]).toEqual(['プラン', '期間', '料金', '特典']);
    expect((await active(tableEditor)).at).toEqual([0, 2]);
  });

  it('端のつまみをドラッグして行を移す（結合の途中には落とせない）', async () => {
    const { el, tableEditor } = await editTable(5, 0); // 注記
    const root = tableEditor.shadowRoot;
    const handle = /** @type {HTMLElement} */ (root.querySelector('.handle[data-axis="row"]'));
    const rows = /** @type {HTMLTableRowElement[]} */ ([...root.querySelectorAll('tr')]);
    // つまみは選んだ行の横
    const handleBox = handle.getBoundingClientRect();
    const rowBox = rows[5].getBoundingClientRect();
    expect(handleBox.top).toBeGreaterThanOrEqual(rowBox.top - 1);
    expect(handleBox.bottom).toBeLessThanOrEqual(rowBox.bottom + 1);

    const pointer = (/** @type {string} */ type, /** @type {number} */ y) =>
      handle.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          composed: true,
          cancelable: true,
          clientX: handleBox.left + 4,
          clientY: y,
          pointerId: 1,
        }),
      );
    pointer('pointerdown', handleBox.top + 4);
    // 結合した 2 行の間: 落とせない
    pointer('pointermove', rows[2].getBoundingClientRect().top);
    await tableEditor.updateComplete;
    expect(root.querySelector('.drop')).toBeNull();
    // 見出しの下
    pointer('pointermove', rows[1].getBoundingClientRect().top + 2);
    await tableEditor.updateComplete;
    expect(root.querySelector('.drop[data-axis="row"]')).not.toBeNull();
    pointer('pointerup', rows[1].getBoundingClientRect().top + 2);
    await frame();
    expect(values(el).cells.map((/** @type {string[]} */ row) => row[0])).toEqual([
      'プラン',
      '注記',
      'ライト',
      '',
      'スタンダード',
      '',
    ]);
    expect(values(el).merges).toContainEqual({ row: 1, column: 1, rowSpan: 1, colSpan: 3 });
    expect((await active(tableEditor)).at).toEqual([1, 0]);
    expect(root.querySelector('.drop')).toBeNull();
  });

  it('列のつまみをドラッグして列を移す', async () => {
    const { el, tableEditor } = await editTable(0, 1); // 期間
    const root = tableEditor.shadowRoot;
    const handle = /** @type {HTMLElement} */ (root.querySelector('.handle[data-axis="column"]'));
    const box = handle.getBoundingClientRect();
    const header = root.querySelectorAll('th');
    const pointer = (/** @type {string} */ type, /** @type {number} */ x) =>
      handle.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          composed: true,
          cancelable: true,
          clientX: x,
          clientY: box.top + 4,
          pointerId: 1,
        }),
      );
    pointer('pointerdown', box.left + 4);
    pointer('pointermove', header[0].getBoundingClientRect().left + 2);
    pointer('pointerup', header[0].getBoundingClientRect().left + 2);
    await frame();
    // 横に結合した 3 列がまとめて動く
    expect(values(el).cells[0]).toEqual(['期間', '料金', '特典', 'プラン']);
  });
});

describe('表: スマホの縦並び', () => {
  it('設定で「縦に並べる」を選ぶと、スマホのプレビューで 1 行ずつ縦に並ぶ', async () => {
    const el = await mount();
    const template = structuredClone(fixtures.tables);
    template.body.rows[0].columns[0].blocks[2].values.mobileLayout = 'table';
    el.loadJson(template);
    el.select('b_tbl000005');
    await frame();
    const field = /** @type {HTMLElement} */ (
      deep(el, 'mm-settings-panel', '[data-key="mobileLayout"]')
    );
    expect(field.textContent).toContain('Outlook');
    const [, stack] = /** @type {NodeListOf<HTMLButtonElement>} */ (
      field.querySelectorAll('.segmented button')
    );
    expect(stack.textContent?.trim()).toBe('縦に並べる');
    stack.click();
    await frame();
    expect(values(el).mobileLayout).toBe('stack');
    expect(el.exportHtml()).toContain('class="mm-show-mobile"');

    el.previewDevice = 'mobile';
    el.view = 'preview';
    await frame();
    const iframe = /** @type {HTMLIFrameElement} */ (deep(el, 'mm-preview', 'iframe'));
    await vi.waitFor(() =>
      expect(iframe.contentDocument?.querySelector('.mm-show-mobile')).not.toBeNull(),
    );
    const doc = /** @type {Document} */ (iframe.contentDocument);
    const win = /** @type {Window} */ (iframe.contentWindow);
    await vi.waitFor(() =>
      expect(
        win.getComputedStyle(/** @type {Element} */ (doc.querySelector('.mm-show-mobile'))).display,
      ).toBe('block'),
    );
    expect(
      win.getComputedStyle(/** @type {Element} */ (doc.querySelector('table.mm-table'))).display,
    ).toBe('none');
    // PC では表
    el.previewDevice = 'desktop';
    await vi.waitFor(() =>
      expect(
        win.getComputedStyle(/** @type {Element} */ (doc.querySelector('.mm-show-mobile'))).display,
      ).toBe('none'),
    );
  });
});
