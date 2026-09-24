import { afterEach, describe, expect, it } from 'vitest';
import { canvasBlocks, deep, deepAll, fixtures, frame, mount } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

/** @param {Element} el */
function center(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * @param {EventTarget} target
 * @param {string} type
 * @param {number} x
 * @param {number} y
 */
function pointer(target, type, x, y) {
  target.dispatchEvent(
    new PointerEvent(type, {
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      bubbles: true,
      composed: true,
    }),
  );
}

/**
 * source を押して (x, y) まで動かして離す。離す直前の状態を返す
 * @param {Element} source
 * @param {number} x
 * @param {number} y
 * @param {{ release?: boolean }} [options]
 */
async function drag(source, x, y, options = {}) {
  const start = center(source);
  pointer(source, 'pointerdown', start.x, start.y);
  pointer(window, 'pointermove', start.x + 10, start.y + 10);
  pointer(window, 'pointermove', x, y);
  await frame();
  if (options.release !== false) {
    pointer(window, 'pointerup', x, y);
    source.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, clientX: x, clientY: y }),
    );
    await frame();
  }
}

/** @param {MailmasonEditor} el */
const json = (el) => el.getJson();

/** @param {MailmasonEditor} el */
async function setup(el) {
  el.loadJson(fixtures.basic);
  await frame();
}

describe('ドラッグ&ドロップ', () => {
  it('パレットのブロックをカラムの途中に置ける（クリックとして二重に追加しない）', async () => {
    const el = await mount();
    await setup(el);
    const item = /** @type {Element} */ (deep(el, 'mm-palette', '[data-block-type="spacer"]'));
    const textBlock = canvasBlocks(el)[1].getBoundingClientRect();
    await drag(item, textBlock.left + 50, textBlock.bottom - 12);
    const blocks = json(el).body.rows[1].columns[0].blocks;
    expect(blocks.map((b) => b.type)).toEqual(['text', 'spacer', 'button']);
    expect(json(el).body.rows).toHaveLength(4);
    expect(el.store.getState().selection).toBe(blocks[1].id);
  });

  it('全行より下に置くと、新しい 1 カラム行を末尾に作る', async () => {
    const el = await mount();
    await setup(el);
    const item = /** @type {Element} */ (deep(el, 'mm-palette', '[data-block-type="divider"]'));
    const canvas = /** @type {HTMLElement} */ (deep(el, 'mm-canvas'));
    canvas.scrollTop = canvas.scrollHeight; // 最後の行の下が見えるように
    await frame();
    const rows = deepAll(el, ['mm-canvas'], 'mm-row');
    const last = rows[rows.length - 1].getBoundingClientRect();
    await drag(item, last.left + 100, last.bottom + 12);
    const rowsAfter = json(el).body.rows;
    expect(rowsAfter).toHaveLength(5);
    expect(rowsAfter[4].columns[0].blocks[0].type).toBe('divider');
  });

  it('行レイアウトを行間に置ける', async () => {
    const el = await mount();
    await setup(el);
    deepAll(el, ['mm-palette'], '[role="tab"]')[1].click();
    await frame();
    const item = /** @type {Element} */ (deep(el, 'mm-palette', '[data-layout="1:2"]'));
    const second = deepAll(el, ['mm-canvas'], 'mm-row')[1].getBoundingClientRect();
    await drag(item, second.left + 100, second.top + 5);
    const rows = json(el).body.rows;
    expect(rows).toHaveLength(5);
    expect(rows[1].layout).toBe('1:2');
  });

  it('保存したコンポーネント（行・ブロック）をドラッグして置ける', async () => {
    const el = await mount();
    await setup(el);
    const template = json(el);
    el.components = [
      { id: 'c_row', name: '商品の行', kind: 'row', version: 1, content: template.body.rows[2] },
      {
        id: 'c_btn',
        name: 'ボタン',
        kind: 'block',
        version: 1,
        content: template.body.rows[1].columns[0].blocks[1],
      },
    ];
    await frame();
    /** @type {HTMLButtonElement} */ (deep(el, 'mm-palette', '[data-tab="saved"]')).click();
    await frame();
    const [rowItem, blockItem] = deepAll(el, ['mm-palette'], '.saved-item .insert');

    const second = deepAll(el, ['mm-canvas'], 'mm-row')[1].getBoundingClientRect();
    await drag(rowItem, second.left + 100, second.top + 5); // 2 行目の上の行間
    let rows = json(el).body.rows;
    expect(rows).toHaveLength(5);
    expect(rows[1].layout).toBe(template.body.rows[2].layout);
    expect(rows[1].id).not.toBe(template.body.rows[2].id);

    // 行を入れたので、テキストブロックは 4 番目（バナー・商品 2 つの後）
    const box = canvasBlocks(el)[3].getBoundingClientRect();
    await drag(blockItem, box.left + 50, box.bottom - 12);
    rows = json(el).body.rows;
    expect(rows[2].columns[0].blocks.map((b) => b.type)).toEqual(['text', 'button', 'button']);
  });

  it('選択中のブロックをつまみで別のカラムへ移せる（Undo 1 回で戻る）', async () => {
    const el = await mount();
    await setup(el);
    el.select('b_button01');
    await frame();
    const handle = /** @type {Element} */ (
      canvasBlocks(el)[2].shadowRoot.querySelector('.chrome-label')
    );
    // 2 カラム行の右のブロック。フォントの違いで画面外にならないよう、見える位置までスクロールする
    canvasBlocks(el)[4].scrollIntoView({ block: 'center' });
    await frame();
    const target = canvasBlocks(el)[4].getBoundingClientRect();
    await drag(handle, target.left + 20, target.top + 20);
    expect(json(el).body.rows[1].columns[0].blocks.map((b) => b.id)).toEqual(['b_text0001']);
    expect(json(el).body.rows[2].columns[1].blocks.map((b) => b.id)).toEqual([
      'b_button01',
      'b_item0002',
    ]);
    el.undo();
    expect(json(el).body.rows[1].columns[0].blocks.map((b) => b.id)).toEqual([
      'b_text0001',
      'b_button01',
    ]);
  });

  it('ブロックを行の端に落とすと、新しい行に移す', async () => {
    const el = await mount();
    await setup(el);
    el.select('b_button01');
    await frame();
    const handle = /** @type {Element} */ (
      canvasBlocks(el)[2].shadowRoot.querySelector('.chrome-label')
    );
    const firstRow = deepAll(el, ['mm-canvas'], 'mm-row')[0].getBoundingClientRect();
    await drag(handle, firstRow.left + 100, firstRow.top + 3);
    const rows = json(el).body.rows;
    expect(rows).toHaveLength(5);
    expect(rows[0].columns[0].blocks.map((b) => b.id)).toEqual(['b_button01']);
  });

  it('行をつまみで並べ替えられる', async () => {
    const el = await mount();
    await setup(el);
    el.select('r_footer01');
    await frame();
    const row = deepAll(el, ['mm-canvas'], 'mm-row')[3];
    const handle = /** @type {Element} */ (row.shadowRoot?.querySelector('.chrome-label'));
    const first = deepAll(el, ['mm-canvas'], 'mm-row')[0].getBoundingClientRect();
    await drag(handle, first.left + 100, first.top + 10);
    expect(json(el).body.rows.map((r) => r.id)).toEqual([
      'r_footer01',
      'r_header01',
      'r_body0001',
      'r_items001',
    ]);
  });

  it('ドラッグ中は挿入線とゴーストを出し、ストアは変更しない', async () => {
    const el = await mount();
    await setup(el);
    const item = /** @type {Element} */ (deep(el, 'mm-palette', '[data-block-type="text"]'));
    const target = canvasBlocks(el)[1].getBoundingClientRect();
    await drag(item, target.left + 50, target.bottom - 10, { release: false });
    expect(el.hasAttribute('dragging')).toBe(true);
    const indicator = /** @type {HTMLElement} */ (
      el.shadowRoot?.querySelector('.mm-drop-indicator')
    );
    expect(indicator.hidden).toBe(false);
    expect(el.shadowRoot?.querySelector('.mm-drag-ghost')?.textContent).toBe('テキスト');
    expect(el.canUndo()).toBe(false);
    pointer(window, 'pointerup', target.left + 50, target.bottom - 10);
    await frame();
    expect(el.hasAttribute('dragging')).toBe(false);
    expect(el.shadowRoot?.querySelector('.mm-drop-indicator')).toBeNull();
  });

  it('Esc で中止すると何も変わらない', async () => {
    const el = await mount();
    await setup(el);
    const item = /** @type {Element} */ (deep(el, 'mm-palette', '[data-block-type="text"]'));
    const target = canvasBlocks(el)[1].getBoundingClientRect();
    await drag(item, target.left + 50, target.bottom - 10, { release: false });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    pointer(window, 'pointerup', target.left + 50, target.bottom - 10);
    item.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await frame();
    expect(json(el)).toEqual(fixtures.basic);
    expect(el.hasAttribute('dragging')).toBe(false);
  });

  it('キャンバスの外で離すと何も変わらない', async () => {
    const el = await mount();
    await setup(el);
    const item = /** @type {Element} */ (deep(el, 'mm-palette', '[data-block-type="text"]'));
    const palette = /** @type {Element} */ (deep(el, 'mm-palette', '[data-block-type="html"]'));
    const p = center(palette);
    await drag(item, p.x, p.y);
    expect(json(el)).toEqual(fixtures.basic);
  });

  it('キャンバスの下端に近づけると自動でスクロールする', async () => {
    const el = await mount();
    await setup(el);
    const canvas = /** @type {HTMLElement} */ (deep(el, 'mm-canvas'));
    const item = /** @type {Element} */ (deep(el, 'mm-palette', '[data-block-type="text"]'));
    const box = canvas.getBoundingClientRect();
    await drag(item, box.left + box.width / 2, box.bottom - 5, { release: false });
    for (let i = 0; i < 5; i++) await frame();
    expect(canvas.scrollTop).toBeGreaterThan(0);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });

  it('少しだけ動かして離したときはクリックとして扱う', async () => {
    const el = await mount();
    await setup(el);
    const item = /** @type {HTMLElement} */ (deep(el, 'mm-palette', '[data-block-type="text"]'));
    const c = center(item);
    pointer(item, 'pointerdown', c.x, c.y);
    pointer(window, 'pointermove', c.x + 2, c.y + 1);
    pointer(window, 'pointerup', c.x + 2, c.y + 1);
    item.click();
    await frame();
    expect(json(el).body.rows).toHaveLength(5); // クリックで末尾に追加
  });
});
