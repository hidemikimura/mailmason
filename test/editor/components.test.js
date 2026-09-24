import { afterEach, describe, expect, it, vi } from 'vitest';
import { deep, deepAll, fixtures, frame, mount, once, typeInto } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */
/** @typedef {import('../../src/index.js').Component} Component */

afterEach(() => {
  document.body.innerHTML = '';
});

/** @param {MailmasonEditor} el */
const savedTab = (el) =>
  /** @type {HTMLButtonElement | null} */ (deep(el, 'mm-palette', '[data-tab="saved"]'));

/** @param {MailmasonEditor} el */
const saveButton = (el) =>
  /** @type {HTMLButtonElement | null} */ (
    deep(el, 'mm-settings-panel', '[data-action="save-component"]')
  );

/** @param {MailmasonEditor} el */
async function openSaved(el) {
  /** @type {HTMLButtonElement} */ (savedTab(el)).click();
  await frame();
  return deepAll(el, ['mm-palette'], '.saved-item');
}

describe('コンポーネント（保存した行・ブロック）', () => {
  it('フックも一覧も無ければ、保存の操作と「保存済み」タブを出さない', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.select(el.getJson().body.rows[2].id);
    await frame();
    expect(savedTab(el)).toBeNull();
    expect(saveButton(el)).toBeNull();
  });

  it('行を名前を付けて保存すると、フックに渡し、返った id 付きのものを一覧に加える', async () => {
    /** @type {Component[]} */
    const received = [];
    const onSaveComponent = vi.fn(async (/** @type {Component} */ component) => {
      received.push(component);
      return { ...component, id: 'cmp_1' };
    });
    const el = await mount({ onSaveComponent });
    el.loadJson(fixtures.basic);
    const row = el.getJson().body.rows[2];
    el.select(row.id);
    await frame();

    const input = /** @type {HTMLInputElement} */ (
      deep(el, 'mm-settings-panel', '#mm-component-name')
    );
    expect(input.placeholder).toBe('行');
    typeInto(input, '商品 2 列');
    await frame();
    /** @type {HTMLButtonElement} */ (saveButton(el)).click();
    await vi.waitFor(() => expect(el.components).toHaveLength(1));

    expect(received[0]).toMatchObject({ name: '商品 2 列', kind: 'row', version: 1 });
    expect(received[0].content).toEqual(row);
    expect(el.components[0].id).toBe('cmp_1');
    await frame();
    expect(deep(el, 'mm-settings-panel', '.save-component [role="status"]')?.textContent).toContain(
      '「商品 2 列」を保存しました',
    );

    const items = await openSaved(el);
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('商品 2 列');
    expect(items[0].textContent).toContain('行');
  });

  it('保存に失敗したら理由を出し、mm-warning を発火する', async () => {
    const el = await mount({
      onSaveComponent: async () => {
        throw new Error('容量オーバー');
      },
    });
    el.loadJson(fixtures.basic);
    el.select('b_button01');
    await frame();
    expect(
      /** @type {HTMLInputElement} */ (deep(el, 'mm-settings-panel', '#mm-component-name'))
        .placeholder,
    ).toBe('ボタン');
    const warned = once(el, 'mm-warning');
    /** @type {HTMLButtonElement} */ (saveButton(el)).click();
    expect(/** @type {CustomEvent} */ (await warned).detail.code).toBe('component-save-failed');
    await frame();
    expect(deep(el, 'mm-settings-panel', '.save-component .error')?.textContent).toContain(
      '容量オーバー',
    );
    expect(el.components).toHaveLength(0);
  });

  it('「保存済み」から入れると複製（新しい ID）になり、何度でも入れられる', async () => {
    const source = await mount({ onSaveComponent: async (c) => ({ ...c, id: 'cmp_row' }) });
    source.loadJson(fixtures.basic);
    const row = source.getJson().body.rows[2];
    source.select(row.id);
    await frame();
    /** @type {HTMLButtonElement} */ (saveButton(source)).click();
    await vi.waitFor(() => expect(source.components).toHaveLength(1));
    const saved = JSON.parse(JSON.stringify(source.components)); // アプリが保存して読み込んだ想定
    source.remove();

    // 別のメール
    const el = await mount({ components: saved });
    el.loadJson(fixtures.kitchenSink);
    const first = el.getJson().body.rows[0];
    el.select(first.id);
    await frame();
    const [item] = await openSaved(el);
    /** @type {HTMLButtonElement} */ (item.querySelector('.insert')).click();
    await frame();
    /** @type {HTMLButtonElement} */ (item.querySelector('.insert')).click();
    await frame();

    const rows = el.getJson().body.rows;
    expect(rows).toHaveLength(fixtures.kitchenSink.body.rows.length + 2);
    const [a, b] = [rows[1], rows[2]]; // 選択中の行の直後に入る
    expect(a.columns[0].blocks.map((x) => x.values)).toEqual(
      row.columns[0].blocks.map((x) => x.values),
    );
    expect(new Set([row.id, a.id, b.id]).size).toBe(3);
    expect(el.store.getState().selection).toBe(b.id);
    el.undo();
    expect(el.getJson().body.rows).toHaveLength(fixtures.kitchenSink.body.rows.length + 1);
  });

  it('ブロックのコンポーネントは選択中のブロックの後ろに入る', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    const button = el.getJson().body.rows[1].columns[0].blocks[1];
    el.components = [{ id: 'c_btn', name: 'CTA', kind: 'block', version: 1, content: button }];
    el.select('b_text0001');
    await frame();
    const [item] = await openSaved(el);
    expect(item.textContent).toContain('ブロック');
    /** @type {HTMLButtonElement} */ (item.querySelector('.insert')).click();
    await frame();
    const blocks = el.getJson().body.rows[1].columns[0].blocks;
    expect(blocks.map((x) => x.type)).toEqual(['text', 'button', 'button']);
    expect(blocks[1].values).toEqual(button.values);
    expect(blocks[1].id).not.toBe(button.id);
  });

  it('削除はフックに任せ、false なら残す', async () => {
    const onDeleteComponent = vi.fn(async (/** @type {Component} */ c) => c.id !== 'keep');
    const el = await mount({
      onDeleteComponent,
      components: [
        { id: 'keep', name: '残す', kind: 'block', version: 1, content: { type: 'spacer' } },
        { id: 'drop', name: '消す', kind: 'block', version: 1, content: { type: 'spacer' } },
      ],
    });
    const items = await openSaved(el);
    /** @type {HTMLButtonElement} */ (
      items[0].querySelector('[data-action="delete-component"]')
    ).click();
    /** @type {HTMLButtonElement} */ (
      items[1].querySelector('[data-action="delete-component"]')
    ).click();
    await vi.waitFor(() => expect(el.components.map((c) => c.id)).toEqual(['keep']));
    expect(onDeleteComponent).toHaveBeenCalledTimes(2);
  });

  it('insertComponent は壊れたコンポーネントを入れずに警告する', async () => {
    const el = await mount();
    const warned = once(el, 'mm-warning');
    expect(el.insertComponent(/** @type {any} */ ({ name: 'x', kind: 'row' }))).toBeNull();
    expect(/** @type {CustomEvent} */ (await warned).detail.code).toBe('invalid-component');
  });
});
