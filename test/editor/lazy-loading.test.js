// 後から読み込む部品: 使うまで読み込まず、使うときに読み込んで表示する。
// テストファイルごとにページが分かれるので、このファイルでは部品が未定義の状態から始まる（helpers の mount は使わない）
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlock, createRow, createTemplate } from '../../src/index.js';
import { canvasBlocks, deep, frame } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

/** @param {Record<string, unknown>} [props] */
async function create(props = {}) {
  const el = /** @type {MailmasonEditor} */ (document.createElement('mailmason-editor'));
  Object.assign(el, props);
  el.style.height = '800px';
  document.body.append(el);
  await el.updateComplete;
  await frame();
  return el;
}

describe('後から読み込む部品', () => {
  it('最初はプレビューと表の編集部品を読み込まない', async () => {
    const el = await create();
    const template = createTemplate();
    template.body.rows.push(createRow('1', [[createBlock('text', { html: '<p>本文</p>' })]]));
    el.loadJson(template);
    await frame();
    expect(customElements.get('mailmason-editor')).toBeDefined();
    expect(customElements.get('mm-preview')).toBeUndefined();
    expect(customElements.get('mm-table-editor')).toBeUndefined();
  });

  it('表: 選ぶと編集部品を読み込み、直接編集できる', async () => {
    const el = await create();
    const template = createTemplate();
    const table = createBlock('table', {
      cells: [
        ['見出し', '値'],
        ['a', 'b'],
      ],
    });
    template.body.rows.push(createRow('1', [[table]]));
    el.loadJson(template);
    await frame();
    el.select(table.id);
    await vi.waitFor(() => expect(customElements.get('mm-table-editor')).toBeDefined());

    const block = /** @type {any} */ (canvasBlocks(el)[0]);
    const cell = block.shadowRoot.querySelector('table.mm-table').rows[1].cells[0];
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await vi.waitFor(() => {
      const editor = block.shadowRoot.querySelector('mm-table-editor');
      expect(editor?.shadowRoot?.querySelector('mm-text-editor')).toBeTruthy();
    });
  });

  it('プレビュー: 切り替えたときに読み込んで表示する', async () => {
    const el = await create();
    el.view = 'preview';
    await vi.waitFor(() => expect(customElements.get('mm-preview')).toBeDefined());
    await vi.waitFor(() => expect(deep(el, 'mm-preview', 'iframe')).not.toBeNull());
  });

  it('QR コード: 作るときに QR のライブラリを読み込む', async () => {
    const onImageUpload = vi.fn(async () => 'https://cdn.example.com/qr.png');
    const el = await create({ onImageUpload });
    const template = createTemplate();
    const qr = createBlock('qr', { content: 'https://example.com/' });
    template.body.rows.push(createRow('1', [[qr]]));
    el.loadJson(template);
    await frame();
    const ok = await /** @type {any} */ (el)._generateQr(qr.id);
    expect(ok).toBe(true);
    const [[file]] = /** @type {any} */ (onImageUpload.mock.calls);
    expect(file.type).toBe('image/png');
    expect(el.getJson().body.rows[0].columns[0].blocks[0].values.src).toBe(
      'https://cdn.example.com/qr.png',
    );
  });

  it("locale が 'ja' 以外なら、英語の文言を読み込んでから描く（日本語を出さない）", async () => {
    const el = await create({ locale: 'en' });
    const toolbar = /** @type {HTMLElement} */ (deep(el, 'mm-toolbar'));
    expect(toolbar.shadowRoot?.textContent).toContain('Preview');
    expect(toolbar.shadowRoot?.textContent).not.toContain('プレビュー');
  });
});
