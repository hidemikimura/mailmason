import { afterEach, describe, expect, it } from 'vitest';
import { createBlock, createRow, createTemplate } from '../../src/index.js';
import { canvasBlocks, deep, deepAll, fixtures, frame, mount, press, typeInto } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

/** content-blocks フィクスチャの表ブロック（4 行 × 3 列、1 行目が見出し） */
const TABLE_INDEX = 3;

/** @param {MailmasonEditor} el */
const tableValues = (el) =>
  /** @type {any} */ (el.getJson().body.rows[TABLE_INDEX].columns[0].blocks[0].values);

/**
 * 表ブロックのセル（キャンバスの出力 HTML）をダブルクリックして直接編集を始める
 * @param {number} row
 * @param {number} column
 */
async function editTable(row = 1, column = 0) {
  const el = await mount();
  el.loadJson(fixtures.contentBlocks);
  await frame();
  const block = /** @type {any} */ (canvasBlocks(el)[TABLE_INDEX]);
  const cell = block.shadowRoot.querySelector('table.mm-table').rows[row].cells[column];
  cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await frame();
  await frame();
  const tableEditor = /** @type {any} */ (block.shadowRoot.querySelector('mm-table-editor'));
  await tableEditor.updateComplete;
  return { el, block, tableEditor };
}

/** @param {any} tableEditor */
async function activeEditable(tableEditor) {
  await tableEditor.updateComplete;
  const editor = tableEditor.shadowRoot.querySelector('mm-text-editor');
  await editor.updateComplete;
  return {
    editor,
    cell: /** @type {HTMLElement} */ (editor.closest('td, th')),
    editable: /** @type {HTMLElement} */ (editor.shadowRoot.querySelector('.editable')),
  };
}

/** @param {HTMLElement} editable */
function caretAtEnd(editable) {
  editable.focus();
  const selection = /** @type {Selection} */ (document.getSelection());
  selection.setBaseAndExtent(
    editable,
    editable.childNodes.length,
    editable,
    editable.childNodes.length,
  );
}

describe('新しいブロックのパレット', () => {
  it('表・メニュー・ボタンの並び・画像ギャラリー・動画を追加でき、初期値が入る', async () => {
    const el = await mount();
    const label = (/** @type {string} */ type) =>
      deep(el, 'mm-palette', `[data-block-type="${type}"] span`)?.textContent;
    expect(['table', 'menu', 'buttons', 'gallery', 'video'].map(label)).toEqual([
      '表',
      'メニュー',
      'ボタンの並び',
      '画像ギャラリー',
      '動画',
    ]);
    for (const type of ['table', 'menu', 'buttons', 'gallery', 'video']) {
      deep(el, 'mm-palette', `[data-block-type="${type}"]`)?.click();
      await frame();
    }
    const blocks = el
      .getJson()
      .body.rows.flatMap((row) => row.columns.flatMap((column) => column.blocks));
    expect(blocks.map((b) => b.type)).toEqual(['table', 'menu', 'buttons', 'gallery', 'video']);
    const [table, menu, buttons, gallery] = blocks.map((b) => /** @type {any} */ (b.values));
    expect(table.cells[0]).toEqual(['項目', '内容']);
    expect(menu.items.map((/** @type {any} */ i) => i.label)).toEqual([
      'メニュー 1',
      'メニュー 2',
      'メニュー 3',
    ]);
    expect(buttons.items).toHaveLength(2);
    expect(gallery.items).toHaveLength(4);
    // 中身が空のブロックは案内を出す
    const video = canvasBlocks(el)[4];
    expect(video.shadowRoot?.querySelector('.placeholder')?.textContent).toContain(
      'サムネイル画像が未設定です',
    );
  });
});

describe('表の直接編集', () => {
  it('セルをダブルクリックすると、そのセルを編集する', async () => {
    const { block, tableEditor } = await editTable(2, 1);
    expect(block.hasAttribute('editing')).toBe(true);
    const { cell, editable, editor } = await activeEditable(tableEditor);
    expect(cell.dataset.row).toBe('2');
    expect(cell.dataset.column).toBe('1');
    expect(editable.innerHTML).toBe('67 cm');
    // 表のセルでは段落・リスト・揃えのツールを出さない
    const toolbar = editor.shadowRoot.querySelector('[role="toolbar"]');
    expect(toolbar.querySelector('[data-command="bold"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-command="ul"]')).toBeNull();
    expect(toolbar.querySelector('select[aria-label="段落の種類"]')).toBeNull();
    // 見出し行は th
    expect(tableEditor.shadowRoot.querySelectorAll('th')).toHaveLength(3);
  });

  it('入力はそのセルだけに反映し、Enter は改行（段落にしない）', async () => {
    const { el, tableEditor } = await editTable(1, 0);
    const { editable } = await activeEditable(tableEditor);
    caretAtEnd(editable);
    document.execCommand('insertText', false, 'X');
    await frame();
    expect(tableValues(el).cells[1]).toEqual(['SX', '64 cm', '52 cm']);
    press(editable, 'Enter');
    document.execCommand('insertText', false, 'Y');
    await frame();
    expect(tableValues(el).cells[1][0]).toBe('SX<br>Y');
    expect(tableValues(el).cells[1][0]).not.toContain('<p>');
    el.undo();
    await frame();
    expect(tableValues(el).cells[1][0]).toBe('S');
  });

  it('Tab で次のセル、Shift+Tab で前のセルに移り、最後のセルで Tab を押すと行を足す', async () => {
    const { el, tableEditor } = await editTable(3, 1);
    let { editable } = await activeEditable(tableEditor);
    let cell;
    press(editable, 'Tab');
    ({ editable, cell } = await activeEditable(tableEditor));
    expect([cell.dataset.row, cell.dataset.column]).toEqual(['3', '2']);
    press(editable, 'Tab', { shiftKey: true });
    ({ editable, cell } = await activeEditable(tableEditor));
    expect([cell.dataset.row, cell.dataset.column]).toEqual(['3', '1']);
    press(editable, 'Tab');
    ({ editable } = await activeEditable(tableEditor));
    press(editable, 'Tab');
    await frame();
    ({ cell } = await activeEditable(tableEditor));
    expect(tableValues(el).cells).toHaveLength(5);
    expect([cell.dataset.row, cell.dataset.column]).toEqual(['4', '0']);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('他のセルを押すと、編集を続けたまま移る', async () => {
    const { block, tableEditor } = await editTable(1, 0);
    await activeEditable(tableEditor);
    const target = tableEditor.shadowRoot.querySelector('[data-row="2"][data-column="2"]');
    target.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true, cancelable: true }),
    );
    const { cell, editable } = await activeEditable(tableEditor);
    expect(cell).toBe(target);
    expect(editable.innerHTML).toBe('55 cm');
    await frame();
    expect(block.hasAttribute('editing')).toBe(true);
  });

  it('下のツールバーで行・列を足したり消したりする', async () => {
    const { el, tableEditor } = await editTable(1, 1);
    await activeEditable(tableEditor);
    const op = (/** @type {string} */ name) =>
      /** @type {HTMLButtonElement} */ (
        tableEditor.shadowRoot.querySelector(`[data-op="${name}"]`)
      );
    op('row-below').click();
    await frame();
    expect(tableValues(el).cells).toHaveLength(5);
    expect(tableValues(el).cells[2]).toEqual(['', '', '']);
    let { cell } = await activeEditable(tableEditor);
    expect([cell.dataset.row, cell.dataset.column]).toEqual(['2', '1']);

    op('column-right').click();
    await frame();
    expect(tableValues(el).columns).toHaveLength(4);
    expect(tableValues(el).cells[0]).toEqual(['サイズ', '着丈', '', '身幅']);

    op('remove-column').click();
    await frame();
    op('remove-row').click();
    await frame();
    // 足した列（編集中の列）と行を消すと元に戻る
    expect(tableValues(el).cells).toEqual(
      fixtures.contentBlocks.body.rows[TABLE_INDEX].columns[0].blocks[0].values.cells,
    );
    ({ cell } = await activeEditable(tableEditor));
    expect(cell).not.toBeNull();
    expect(tableValues(el).columns).toHaveLength(3);
  });

  it('Escape で編集を終える', async () => {
    const { block, tableEditor } = await editTable(0, 0);
    const { editable } = await activeEditable(tableEditor);
    press(editable, 'Escape');
    await frame();
    expect(block.hasAttribute('editing')).toBe(false);
    expect(block.shadowRoot.querySelector('mm-table-editor')).toBeNull();
  });
});

describe('新しいブロックの設定', () => {
  /**
   * @param {string} type
   * @param {Record<string, unknown>} [values]
   */
  async function openBlock(type, values = {}) {
    const el = await mount();
    const template = createTemplate();
    const block = createBlock(type, values);
    template.body.rows.push(createRow('1', [[block]]));
    el.loadJson(template);
    el.select(block.id);
    await frame();
    return el;
  }
  /** @param {MailmasonEditor} el */
  const values = (el) => /** @type {any} */ (el.getJson().body.rows[0].columns[0].blocks[0].values);
  /** @param {MailmasonEditor} el @param {string} key */
  const field = (el, key) =>
    /** @type {HTMLElement} */ (deep(el, 'mm-settings-panel', `[data-key="${key}"]`));

  it('表の列ごとに幅と揃えを変える', async () => {
    const el = await openBlock('table', { cells: [['a', 'b']] });
    const columns = field(el, 'columns');
    expect(columns.querySelectorAll('.table-column')).toHaveLength(2);
    typeInto(/** @type {HTMLInputElement} */ (columns.querySelector('input')), '30');
    await frame();
    /** @type {HTMLButtonElement} */ (
      field(el, 'columns').querySelectorAll('.table-column')[1].querySelector('[aria-label="右"]')
    ).click();
    await frame();
    expect(values(el).columns).toEqual([
      { width: 30, align: 'left' },
      { width: null, align: 'right' },
    ]);
    typeInto(/** @type {HTMLInputElement} */ (field(el, 'columns').querySelector('input')), '');
    await frame();
    expect(values(el).columns[0].width).toBeNull();
    expect(field(el, 'cells').textContent).toContain('1 行 × 2 列');
  });

  it('ボタンの並び: 項目を足すとキャンバスに並ぶ', async () => {
    const el = await openBlock('buttons', {
      items: [{ label: 'A', href: '', backgroundColor: '#0066cc', color: '#ffffff' }],
    });
    /** @type {HTMLButtonElement} */ (
      field(el, 'items').querySelector('[data-action="add-item"]')
    ).click();
    await frame();
    const labels = deepAll(
      el,
      ['mm-settings-panel'],
      '[data-key="items"] [data-key="label"] input',
    );
    typeInto(/** @type {HTMLInputElement} */ (labels[1]), 'B');
    await frame();
    expect(values(el).items.map((/** @type {any} */ i) => i.label)).toEqual(['A', 'B']);
    expect(field(el, 'items').querySelectorAll('.list-head span')[1].textContent).toBe('B');
    expect(canvasBlocks(el)[0].shadowRoot?.textContent).toContain('B');
  });

  it('動画: YouTube の URL を入れるとサムネイルを入れる（自分の画像は上書きしない）', async () => {
    const el = await openBlock('video');
    const input = /** @type {HTMLInputElement} */ (field(el, 'url').querySelector('input'));
    typeInto(input, 'https://youtu.be/dQw4w9WgXcQ');
    await frame();
    expect(values(el).thumbnail).toMatchObject({
      src: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      naturalWidth: 480,
      naturalHeight: 360,
    });
    typeInto(
      /** @type {HTMLInputElement} */ (field(el, 'thumbnail.src').querySelector('input')),
      'https://cdn.example.com/own.jpg',
    );
    await frame();
    typeInto(
      /** @type {HTMLInputElement} */ (field(el, 'url').querySelector('input')),
      'https://www.youtube.com/watch?v=aaaaaaaaaaa',
    );
    await frame();
    expect(values(el).thumbnail.src).toBe('https://cdn.example.com/own.jpg');
    // 再生ボタンなしでは縦横比の設定を出さない
    expect(field(el, 'ratio')).not.toBeNull();
    /** @type {HTMLSelectElement} */ (field(el, 'playButton').querySelector('select')).value =
      'none';
    field(el, 'playButton').querySelector('select')?.dispatchEvent(new Event('change'));
    await frame();
    expect(field(el, 'ratio')).toBeNull();
  });
});
