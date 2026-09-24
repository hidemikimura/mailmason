import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlock, createRow, createTemplate, defineBlock } from '../../src/index.js';
import { couponBlock, productListBlock } from '../fixtures/custom-blocks.js';
import { canvasBlocks, deep, deepAll, frame, imageUrl, mount, once, typeInto } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

// 設定欄に置く独自の部品（テスト用）
class TestPicker extends HTMLElement {
  connectedCallback() {
    if (this.querySelector('button')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'pick';
    button.addEventListener('click', () =>
      this.dispatchEvent(
        new CustomEvent('mm-field-change', { detail: { value: { sku: 'A-1' } }, bubbles: true }),
      ),
    );
    this.append(button);
  }
}
if (!customElements.get('test-picker')) customElements.define('test-picker', TestPicker);

/** @type {ReturnType<typeof vi.fn>} */
let actionRun = vi.fn();
const pickerBlock = defineBlock({
  type: 'test-product',
  label: '商品（外部）',
  fields: [
    { key: 'product', kind: 'element', label: '商品', tagName: 'test-picker' },
    { key: 'name', kind: 'text', label: '商品名' },
    { kind: 'action', label: '商品を読み込む', run: (ctx) => actionRun(ctx) },
  ],
  renderHtml: (v, ctx) => (v.name ? `<p class="product">${ctx.escape(v.name)}</p>` : ''),
});
const brokenBlock = defineBlock({
  type: 'test-broken',
  label: '壊れたブロック',
  fields: [],
  renderHtml: () => {
    throw new Error('boom');
  },
});

const blocks = [couponBlock, productListBlock, pickerBlock, brokenBlock];

/**
 * カスタムブロックを 1 つ置いたエディタ
 * @param {string} type
 * @param {Record<string, unknown>} [values]
 * @param {Record<string, unknown>} [props]
 */
async function openBlock(type, values = {}, props = {}) {
  const el = await mount({ blocks, ...props });
  const template = createTemplate();
  const block = createBlock(type, values, { blocks });
  template.body.rows.push(createRow('1', [[block]]));
  el.loadJson(template);
  el.select(block.id);
  await frame();
  return { el, blockId: block.id };
}

/** @param {MailmasonEditor} el */
const values = (el) => /** @type {any} */ (el.getJson().body.rows[0].columns[0].blocks[0].values);

/** @param {MailmasonEditor} el @param {string} key */
const field = (el, key) =>
  /** @type {HTMLElement} */ (deep(el, 'mm-settings-panel', `[data-key="${key}"]`));

describe('カスタムブロック', () => {
  it('パレットに出し、クリックで追加すると定義の HTML をキャンバスに表示する', async () => {
    const el = await mount({ blocks });
    const item = /** @type {HTMLElement} */ (
      deep(el, 'mm-palette', '[data-block-type="acme-coupon"]')
    );
    expect(item.textContent?.trim()).toBe('クーポン');
    expect(item.querySelector('svg')).not.toBeNull();
    item.click();
    await frame();
    const [block] = canvasBlocks(el);
    expect(block.shadowRoot?.textContent).toContain('AUTUMN2026');
    expect(deep(el, 'mm-settings-panel', 'nav')?.textContent).toContain('クーポン');
    expect(field(el, 'code').querySelector('label')?.textContent).toBe('コード');

    el.locale = 'en';
    await frame();
    expect(deep(el, 'mm-palette', '[data-block-type="acme-coupon"]')?.textContent?.trim()).toBe(
      'Coupon',
    );
  });

  it('設定欄の変更がキャンバスと書き出しに反映される', async () => {
    const { el } = await openBlock('acme-coupon');
    typeInto(/** @type {HTMLInputElement} */ (field(el, 'code').querySelector('input')), 'VIP-99');
    await frame();
    expect(values(el).code).toBe('VIP-99');
    expect(canvasBlocks(el)[0].shadowRoot?.textContent).toContain('VIP-99');
    expect(el.exportHtml()).toContain('VIP-99');
    expect(el.exportText()).toContain('期間限定クーポン: VIP-99');
  });

  it('リストの項目を追加・並べ替え・削除でき、項目の中の画像もアップロードできる', async () => {
    const onImageUpload = vi.fn(async () => ({ url: imageUrl(40, 40), data: { id: 'p1' } }));
    const { el } = await openBlock('acme-products', {}, { onImageUpload });
    const list = () => field(el, 'items');
    expect(values(el).items).toHaveLength(1);
    // 最少 1 件なので削除できない
    expect(
      /** @type {HTMLButtonElement} */ (list().querySelector('[data-action="remove-item"]'))
        .disabled,
    ).toBe(true);

    /** @type {HTMLButtonElement} */ (list().querySelector('[data-action="add-item"]')).click();
    await frame();
    expect(values(el).items).toHaveLength(2);
    const names = () =>
      deepAll(el, ['mm-settings-panel'], '[data-key="items"] [data-key="name"] input');
    typeInto(/** @type {HTMLInputElement} */ (names()[1]), 'コート');
    await frame();
    expect(values(el).items.map((/** @type {any} */ i) => i.name)).toEqual(['ニット', 'コート']);
    expect(list().querySelectorAll('.list-head span')[1].textContent).toBe('コート');

    // 2 件目を上へ
    /** @type {HTMLButtonElement} */ (
      list().querySelectorAll('.list-item')[1].querySelector('[title="上へ"]')
    ).click();
    await frame();
    expect(values(el).items.map((/** @type {any} */ i) => i.name)).toEqual(['コート', 'ニット']);

    // 1 件目の画像をアップロード（ファイルのドロップ）
    const image = /** @type {HTMLElement} */ (
      list().querySelectorAll('.list-item')[0].querySelector('[data-key="image.src"] .image')
    );
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 4;
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const data = new DataTransfer();
    data.items.add(new File([/** @type {Blob} */ (blob)], 'a.png', { type: 'image/png' }));
    const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data });
    if (/** @type {any} */ (drop).dataTransfer !== data) {
      Object.defineProperty(drop, 'dataTransfer', { value: data });
    }
    image.dispatchEvent(drop);
    await vi.waitFor(() => expect(values(el).items[0].image.src).toBe(imageUrl(40, 40)));
    expect(values(el).items[0].image).toMatchObject({ naturalWidth: 4, uploadData: { id: 'p1' } });
    expect(values(el).items[1].image.src).toBe(''); // ほかの項目はそのまま

    // 削除
    /** @type {HTMLButtonElement} */ (
      list().querySelectorAll('[data-action="remove-item"]')[1]
    ).click();
    await frame();
    expect(values(el).items.map((/** @type {any} */ i) => i.name)).toEqual(['コート']);
  });

  it('action は利用者の処理を呼び、返った値をブロックに入れる（失敗は表示と警告）', async () => {
    actionRun = vi.fn(async () => ({ name: '読み込んだ商品' }));
    const { el, blockId } = await openBlock('test-product');
    const button = () =>
      /** @type {HTMLButtonElement} */ (
        deep(el, 'mm-settings-panel', '[data-action="custom-action"]')
      );
    expect(button().textContent?.trim()).toBe('商品を読み込む');
    button().click();
    await vi.waitFor(() => expect(values(el).name).toBe('読み込んだ商品'));
    expect(actionRun).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId,
        locale: 'ja',
        values: expect.objectContaining({ name: '' }),
      }),
    );

    actionRun = vi.fn(async () => {
      throw new Error('API エラー');
    });
    const warned = once(el, 'mm-warning');
    button().click();
    const detail = /** @type {CustomEvent} */ (await warned).detail;
    expect(detail.code).toBe('block-action-failed');
    await frame();
    expect(deep(el, 'mm-settings-panel', '.action .error')?.textContent).toContain('API エラー');
  });

  it('element は利用者のカスタム要素を置き、mm-field-change で値を受け取る', async () => {
    const { el, blockId } = await openBlock('test-product');
    const picker = /** @type {any} */ (deep(el, 'mm-settings-panel', 'test-picker'));
    expect(picker.value).toBeNull();
    expect(picker.blockId).toBe(blockId);
    picker.querySelector('button').click();
    await frame();
    expect(values(el).product).toEqual({ sku: 'A-1' });
    expect(/** @type {any} */ (deep(el, 'mm-settings-panel', 'test-picker')).value).toEqual({
      sku: 'A-1',
    });
  });

  it('描画で例外が起きても止めずに、キャンバスに表示できないことを出す', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { el } = await openBlock('test-broken');
    expect(canvasBlocks(el)[0].shadowRoot?.querySelector('.placeholder.error')).not.toBeNull();
    spy.mockRestore();
  });

  it('定義より先に読み込んだテンプレートも、blocks を渡すと値を整え直す', async () => {
    const el = await mount();
    const template = createTemplate();
    const block = createBlock('acme-coupon', {}, { blocks });
    delete (/** @type {any} */ (block.values).title);
    template.body.rows.push(createRow('1', [[block]]));
    el.loadJson(template);
    await frame();
    expect(canvasBlocks(el)[0].shadowRoot?.querySelector('.placeholder')).not.toBeNull();
    expect(values(el).title).toBeUndefined();

    el.blocks = blocks;
    await frame();
    expect(values(el).title).toBe('期間限定クーポン');
    expect(canvasBlocks(el)[0].shadowRoot?.textContent).toContain('AUTUMN2026');
  });
});
