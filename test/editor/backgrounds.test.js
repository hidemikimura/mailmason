import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlock, createRow, createTemplate } from '../../src/index.js';
import { deep, deepAll, fixtures, frame, imageUrl, mount, typeInto } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

/** @param {Record<string, unknown>} [props] */
async function setup(props = {}) {
  const el = await mount(props);
  const template = createTemplate();
  const row = createRow('1:1', [[createBlock('text', { html: '<p>左</p>' })], []]);
  row.id = 'r_row000001';
  row.columns[0].id = 'c_col000001';
  row.columns[1].id = 'c_col000002';
  template.body.rows.push(row);
  el.loadJson(template);
  await frame();
  return el;
}

/** @param {MailmasonEditor} el @param {string} key */
const field = (el, key) =>
  /** @type {HTMLElement} */ (deep(el, 'mm-settings-panel', `[data-key="${key}"]`));

/**
 * 1 x 1 の PNG
 * @returns {Promise<File>}
 */
async function pngFile() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new File([/** @type {Blob} */ (blob)], 'bg.png', { type: 'image/png' });
}

describe('背景画像の設定', () => {
  it('行: URL を入れるとサイズ・位置・繰り返しの設定が出て、キャンバスに背景を表示する', async () => {
    const el = await setup();
    el.select('r_row000001');
    await frame();
    const bg = () => el.getJson().body.rows[0].settings.backgroundImage;
    const src = imageUrl(40, 40);
    expect(field(el, 'backgroundImage').querySelector('[data-option="size"]')).toBeNull();
    typeInto(
      /** @type {HTMLInputElement} */ (field(el, 'backgroundImage').querySelector('input')),
      src,
    );
    await frame();
    expect(bg().src).toBe(src);

    const size = /** @type {HTMLSelectElement} */ (
      field(el, 'backgroundImage').querySelector('[data-option="size"]')
    );
    size.value = 'contain';
    size.dispatchEvent(new Event('change'));
    await frame();
    /** @type {HTMLButtonElement} */ (
      field(el, 'backgroundImage').querySelector('[data-position="right bottom"]')
    ).click();
    await frame();
    const repeat = /** @type {HTMLInputElement} */ (
      field(el, 'backgroundImage').querySelector('[data-option="repeat"]')
    );
    repeat.checked = true;
    repeat.dispatchEvent(new Event('change'));
    await frame();
    expect(bg()).toEqual({
      src,
      size: 'contain',
      position: 'right bottom',
      repeat: 'repeat',
      uploadData: null,
    });
    expect(
      field(el, 'backgroundImage')
        .querySelector('[data-position="right bottom"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    // 実寸や代替テキストは持たない（不正な項目を作らない）
    expect(Object.keys(bg()).sort()).toEqual(['position', 'repeat', 'size', 'src', 'uploadData']);

    const rowEl = /** @type {HTMLElement} */ (deep(el, 'mm-canvas', 'mm-row', '.row'));
    expect(rowEl.style.backgroundImage).toContain('data:image/svg+xml');
    expect(rowEl.style.backgroundSize).toBe('contain');
    expect(rowEl.style.backgroundRepeat).toBe('repeat');
    expect(el.exportHtml()).toContain('background-size:contain');
  });

  it('カラム・本文・外側にも設定できる', async () => {
    const el = await setup();
    const src = imageUrl(20, 20);
    el.select('c_col000002');
    await frame();
    typeInto(
      /** @type {HTMLInputElement} */ (field(el, 'backgroundImage').querySelector('input')),
      src,
    );
    await frame();
    expect(el.getJson().body.rows[0].columns[1].settings.backgroundImage.src).toBe(src);
    const columnEl = deepAll(el, ['mm-canvas', 'mm-row'], '.column-inner')[1];
    expect(columnEl.style.backgroundImage).toContain('data:image/svg+xml');

    el.select(null);
    await frame();
    for (const key of ['backgroundImage', 'contentBackgroundImage']) {
      typeInto(/** @type {HTMLInputElement} */ (field(el, key).querySelector('input')), src);
      await frame();
    }
    const settings = el.getJson().body.settings;
    expect(settings.backgroundImage.src).toBe(src);
    expect(settings.contentBackgroundImage.src).toBe(src);
    expect(field(el, 'contentBackgroundImage').textContent).toContain('Outlook');
    expect(
      /** @type {HTMLElement} */ (deep(el, 'mm-canvas', '.surface')).style.backgroundImage,
    ).toContain('data:image/svg+xml');
    expect(
      /** @type {HTMLElement} */ (deep(el, 'mm-canvas', '.mail')).style.backgroundImage,
    ).toContain('data:image/svg+xml');
  });

  it('アップロード: フックに行の ID と target を渡し、返った URL と data を背景画像に入れる', async () => {
    const url = imageUrl(10, 10);
    const onImageUpload = vi.fn(async () => ({ url, data: { id: 'bg-1' } }));
    const el = await setup({ onImageUpload });
    el.select('r_row000001');
    await frame();
    const input = /** @type {HTMLInputElement} */ (
      field(el, 'backgroundImage').querySelector('input[type="file"]')
    );
    const data = new DataTransfer();
    data.items.add(await pngFile());
    input.files = data.files;
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() =>
      expect(el.getJson().body.rows[0].settings.backgroundImage.src).toBe(url),
    );
    expect(onImageUpload.mock.calls[0][1]).toEqual({ blockId: 'r_row000001', target: 'row' });
    expect(el.getJson().body.rows[0].settings.backgroundImage.uploadData).toEqual({
      id: 'bg-1',
    });

    // メール全体
    el.select(null);
    await frame();
    const bodyInput = /** @type {HTMLInputElement} */ (
      field(el, 'contentBackgroundImage').querySelector('input[type="file"]')
    );
    const bodyData = new DataTransfer();
    bodyData.items.add(await pngFile());
    bodyInput.files = bodyData.files;
    bodyInput.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(el.getJson().body.settings.contentBackgroundImage.src).toBe(url));
    expect(onImageUpload.mock.calls[1][1]).toEqual({ blockId: 'body', target: 'body' });
  });

  it('backgrounds フィクスチャを読み込むと、キャンバスに背景を表示する', async () => {
    const el = await mount();
    el.loadJson(fixtures.backgrounds);
    await frame();
    const rowEl = /** @type {HTMLElement} */ (deep(el, 'mm-canvas', 'mm-row', '.row'));
    expect(rowEl.style.backgroundImage).toContain('hero-bg.jpg');
    expect(
      /** @type {HTMLElement} */ (deep(el, 'mm-canvas', '.surface')).style.backgroundRepeat,
    ).toBe('repeat');
  });
});
