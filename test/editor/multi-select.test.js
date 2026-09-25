// 複数選択と、行・ブロックのコピー＆貼り付け（別のエディタへの貼り付けを含む）
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasBlocks, deep, deepAll, fixtures, frame, mount, press } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// basic フィクスチャ:
//   r_header01 [b_banner01]
//   r_body0001 [b_text0001, b_button01]
//   r_items001 [b_item0001] [b_item0002]
//   r_footer01 [b_divide01, b_social01, b_space001, b_text0002]

async function setup() {
  const el = await mount();
  el.loadJson(fixtures.basic);
  await frame();
  return el;
}

/** @param {MailmasonEditor} el @param {string} id */
const blockEl = (el, id) =>
  /** @type {HTMLElement} */ (canvasBlocks(el).find((b) => /** @type {any} */ (b).block.id === id));

/** @param {MailmasonEditor} el @param {string} id */
const rowEl = (el, id) =>
  /** @type {HTMLElement} */ (
    deepAll(el, ['mm-canvas'], 'mm-row').find((r) => /** @type {any} */ (r).row.id === id)
  );

/**
 * @param {HTMLElement} target
 * @param {MouseEventInit} [init]
 */
function click(target, init = {}) {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, ...init }));
}

/** @param {MailmasonEditor} el */
const selectedIds = (el) => /** @type {any} */ (el).store.getState().selectedIds;

/** @param {MailmasonEditor} el */
const canvas = (el) => /** @type {HTMLElement} */ (deep(el, 'mm-canvas'));

/** ブラウザに依らないクリップボード（Firefox は合成した ClipboardEvent の clipboardData に書き込めない） */
class FakeClipboard {
  /** @type {Map<string, string>} */
  #data = new Map();
  files = /** @type {File[]} */ ([]);
  get types() {
    return [...this.#data.keys()];
  }
  /** @param {string} type @param {string} value */
  setData(type, value) {
    this.#data.set(type, value);
  }
  /** @param {string} type */
  getData(type) {
    return this.#data.get(type) ?? '';
  }
}

/**
 * @param {string} type
 * @param {HTMLElement} target
 * @param {FakeClipboard} [data]
 */
function clipboardEvent(type, target, data = new FakeClipboard()) {
  const event = new ClipboardEvent(type, { bubbles: true, composed: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: data });
  target.dispatchEvent(event);
  return { event, data };
}

describe('複数選択', () => {
  it('Shift / Cmd+クリックでブロックをまとめて選び、操作ボタンは出さず、設定パネルに件数を出す', async () => {
    const el = await setup();
    const events = /** @type {any[]} */ ([]);
    el.addEventListener('mm-select', (e) => events.push(/** @type {CustomEvent} */ (e).detail));
    click(blockEl(el, 'b_text0001'));
    click(blockEl(el, 'b_item0002'), { shiftKey: true });
    click(blockEl(el, 'b_text0002'), { metaKey: true });
    await frame();
    expect(selectedIds(el)).toEqual(['b_text0001', 'b_item0002', 'b_text0002']);
    expect(events.at(-1)).toEqual({
      id: 'b_text0002',
      kind: 'block',
      ids: ['b_text0001', 'b_item0002', 'b_text0002'],
    });
    for (const id of ['b_text0001', 'b_item0002', 'b_text0002']) {
      const b = blockEl(el, id);
      expect(b.hasAttribute('selected')).toBe(true);
      expect(b.shadowRoot?.querySelector('.chrome')).toBeNull();
    }
    const panel = /** @type {HTMLElement} */ (deep(el, 'mm-settings-panel'));
    expect(panel.shadowRoot?.textContent).toContain('3 個のブロックを選択中');

    // もう一度 Shift+クリックで外す
    click(blockEl(el, 'b_item0002'), { shiftKey: true });
    await frame();
    expect(selectedIds(el)).toEqual(['b_text0001', 'b_text0002']);
    // 選択中のテキストを普通にクリックしても、まとめて選んでいるときは直接編集に入らず選び直す
    click(blockEl(el, 'b_text0001'));
    await frame();
    expect(selectedIds(el)).toEqual(['b_text0001']);
    expect(blockEl(el, 'b_text0001').hasAttribute('editing')).toBe(false);
  });

  it('行もまとめて選べる。ブロックを足すと選び直す', async () => {
    const el = await setup();
    click(rowEl(el, 'r_header01'));
    click(rowEl(el, 'r_footer01'), { ctrlKey: true });
    await frame();
    expect(selectedIds(el)).toEqual(['r_header01', 'r_footer01']);
    expect(rowEl(el, 'r_footer01').hasAttribute('data-selected')).toBe(true);
    expect(rowEl(el, 'r_footer01').shadowRoot?.querySelector('.chrome')).toBeNull();
    expect(
      /** @type {HTMLElement} */ (deep(el, 'mm-settings-panel')).shadowRoot?.textContent,
    ).toContain('2 個の行を選択中');
    click(blockEl(el, 'b_button01'), { shiftKey: true });
    await frame();
    expect(selectedIds(el)).toEqual(['b_button01']);
  });

  it('Delete でまとめて削除し、Undo 1 回で戻る。Cmd+D でまとめて複製して複製を選ぶ', async () => {
    const el = await setup();
    el.select(['b_text0001', 'b_text0002']);
    await frame();
    canvas(el).focus();
    press(canvas(el), 'd', { metaKey: true });
    await frame();
    const json = el.getJson();
    const body = json.body.rows[1].columns[0].blocks;
    const footer = json.body.rows[3].columns[0].blocks;
    expect(body).toHaveLength(3);
    expect(footer).toHaveLength(5);
    expect(selectedIds(el)).toEqual([body[1].id, footer[4].id]);

    press(canvas(el), 'Delete');
    await frame();
    expect(el.getJson().body.rows[1].columns[0].blocks).toHaveLength(2);
    expect(el.getJson().body.rows[3].columns[0].blocks).toHaveLength(4);
    el.undo();
    await frame();
    expect(el.getJson().body.rows[1].columns[0].blocks).toHaveLength(3);
  });

  it('設定パネルのボタンで複製・削除・コピーできる', async () => {
    const el = await setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    el.select(['r_header01', 'r_items001']);
    await frame();
    const action = (/** @type {string} */ name) =>
      /** @type {HTMLButtonElement} */ (deep(el, 'mm-settings-panel', `[data-action="${name}"]`));
    action('copy').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    const payload = JSON.parse(/** @type {string} */ (writeText.mock.calls[0][0]));
    expect(payload).toMatchObject({ mailmason: 'clipboard', kind: 'rows' });
    expect(payload.items.map((/** @type {any} */ r) => r.id)).toEqual(['r_header01', 'r_items001']);
    await frame();
    expect(
      /** @type {HTMLElement} */ (deep(el, 'mm-settings-panel')).shadowRoot?.textContent,
    ).toContain('コピーしました');

    action('duplicate').click();
    await frame();
    expect(el.getJson().body.rows).toHaveLength(6);
    action('remove').click();
    await frame();
    expect(el.getJson().body.rows).toHaveLength(4);
  });
});

describe('コピー＆貼り付け', () => {
  it('コピーしたブロックを、別のエディタの選んだブロックの後ろに貼り付ける（ID は振り直す）', async () => {
    const from = await setup();
    from.select(['b_text0001', 'b_button01']);
    await frame();
    const { event, data } = clipboardEvent('copy', canvas(from));
    expect(event.defaultPrevented).toBe(true);
    const text = data.getData('text/plain');
    expect(JSON.parse(text)).toMatchObject({ mailmason: 'clipboard', kind: 'blocks' });

    const to = await mount();
    to.loadJson(fixtures.kitchenSink);
    await frame();
    const firstRow = to.getJson().body.rows[0];
    const anchor = firstRow.columns[0].blocks[0].id;
    to.select(anchor);
    await frame();
    const pasted = new FakeClipboard();
    pasted.setData('text/plain', text);
    const result = clipboardEvent('paste', canvas(to), pasted);
    expect(result.event.defaultPrevented).toBe(true);
    await frame();
    const blocks = to.getJson().body.rows[0].columns[0].blocks;
    expect(blocks[0].id).toBe(anchor);
    expect(blocks[1].type).toBe('text');
    expect(blocks[2].type).toBe('button');
    expect(blocks[1].id).not.toBe('b_text0001');
    expect(selectedIds(to)).toEqual([blocks[1].id, blocks[2].id]);
    // 1 回の Undo で戻る
    to.undo();
    expect(to.getJson().body.rows[0].columns[0].blocks).toHaveLength(
      firstRow.columns[0].blocks.length,
    );
  });

  it('切り取りは消してからクリップボードに入れる。行は選んだ行の後ろに貼り付ける', async () => {
    const el = await setup();
    el.select(['r_header01']);
    await frame();
    const { data } = clipboardEvent('cut', canvas(el));
    await frame();
    expect(el.getJson().body.rows.map((r) => r.id)).toEqual([
      'r_body0001',
      'r_items001',
      'r_footer01',
    ]);
    el.select('r_footer01');
    await frame();
    clipboardEvent('paste', canvas(el), data);
    await frame();
    const rows = el.getJson().body.rows;
    expect(rows).toHaveLength(4);
    expect(rows[3].columns[0].blocks[0].type).toBe('image');
  });

  it('Mailmason のデータでなければ貼り付けない。入力欄・文字を選んでいるときのコピーは邪魔しない', async () => {
    const el = await setup();
    el.select('b_button01');
    await frame();
    const plain = new FakeClipboard();
    plain.setData('text/plain', 'ただの文章');
    const paste = clipboardEvent('paste', canvas(el), plain);
    expect(paste.event.defaultPrevented).toBe(false);
    expect(el.getJson().body.rows[1].columns[0].blocks).toHaveLength(2);

    // 設定パネルの入力欄でのコピー
    const input = /** @type {HTMLInputElement} */ (deep(el, 'mm-settings-panel', 'input'));
    const inInput = clipboardEvent('copy', input);
    expect(inInput.event.defaultPrevented).toBe(false);
  });

  it('Cmd+C / V のキーで、見えない入力欄にフォーカスを移してから元に戻す', async () => {
    const el = await setup();
    el.select('b_button01');
    await frame();
    canvas(el).focus();
    press(canvas(el), 'c', { metaKey: true });
    const proxy = /** @type {HTMLTextAreaElement} */ (
      el.shadowRoot?.querySelector('.clipboard-proxy')
    );
    expect(proxy).not.toBeNull();
    expect(el.shadowRoot?.activeElement).toBe(proxy);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(el.shadowRoot?.activeElement).toBe(canvas(el));
  });
});
