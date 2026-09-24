import { afterEach, describe, expect, it, vi } from 'vitest';
import jsQR from 'jsqr';
import { createBlock, createRow, createTemplate } from '../../src/core/index.js';
import { canvasBlocks, deep, frame, mount, once, typeInto } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

/** @param {Record<string, unknown>} values */
function qrTemplate(values) {
  const template = createTemplate();
  const block = createBlock('qr', values);
  template.body.rows.push(createRow('1', [[block]]));
  return { template, blockId: block.id };
}

/**
 * QR ブロックを置いたエディタを開き、そのブロックを選択する
 * @param {Record<string, unknown>} values
 * @param {Record<string, unknown>} [props]
 */
async function openQr(values, props = {}) {
  const el = await mount(props);
  const { template, blockId } = qrTemplate(values);
  el.loadJson(template);
  el.select(blockId);
  await frame();
  return { el, blockId };
}

/**
 * PNG ファイルの QR を読み取る
 * @param {File} file
 * @returns {Promise<string | null>}
 */
async function decode(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  g.drawImage(bitmap, 0, 0);
  const { data, width, height } = g.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(data, width, height)?.data ?? null;
}

/** @param {MailmasonEditor} el */
const qrValues = (el) => /** @type {any} */ (el.getJson().body.rows[0].columns[0].blocks[0].values);

/** @param {MailmasonEditor} el */
const generateButton = (el) =>
  /** @type {HTMLButtonElement | null} */ (
    deep(el, 'mm-settings-panel', '[data-action="generate-qr"]')
  );

/** アップロードの完了（src が入る）まで待つ */
async function settle() {
  for (let i = 0; i < 20; i++) await frame();
}

describe('QR コード', () => {
  it('onImageUpload が無ければパレットに出さず、設定パネルに案内を出す', async () => {
    const el = await mount();
    expect(deep(el, 'mm-palette', '[data-block-type="qr"]')).toBeNull();
    el.remove();

    const withHook = await mount({ onImageUpload: async () => 'https://cdn.example.com/x.png' });
    expect(deep(withHook, 'mm-palette', '[data-block-type="qr"]')).not.toBeNull();
    withHook.remove();

    const { el: noHook } = await openQr({ content: 'https://example.com/' });
    expect(generateButton(noHook)).toBeNull();
    expect(deep(noHook, 'mm-settings-panel', '.qr .help')?.textContent).toContain('onImageUpload');
  });

  it('「QR コードを作成」で PNG を作ってアップロードし、URL を src に入れる', async () => {
    /** @type {File[]} */
    const files = [];
    const hook = vi.fn(async (/** @type {File} */ file) => {
      files.push(file);
      return { url: 'https://cdn.example.com/qr-1.png', data: { id: 'qr_1' } };
    });
    const content = 'https://example.com/キャンペーン?id=42';
    const { el, blockId } = await openQr(
      { content, size: 120, color: '#1f2937', backgroundColor: '#fefce8' },
      { onImageUpload: hook },
    );
    const button = /** @type {HTMLButtonElement} */ (generateButton(el));
    expect(button.textContent?.trim()).toBe('QR コードを作成');
    button.click();
    await settle();

    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook.mock.calls[0][1]).toEqual({ blockId });
    const [file] = files;
    expect(file.type).toBe('image/png');
    expect(await decode(file)).toBe(content); // 日本語を含む URL も UTF-8 で読める
    const bitmap = await createImageBitmap(file);
    expect(bitmap.width).toBeGreaterThanOrEqual(240); // 表示サイズの 2 倍以上

    const values = qrValues(el);
    expect(values.src).toBe('https://cdn.example.com/qr-1.png');
    expect(values.uploadData).toEqual({ id: 'qr_1' });
    expect(values).not.toHaveProperty('naturalWidth');
    expect(generateButton(el)?.textContent?.trim()).toBe('作り直す');
    expect(el.exportHtml()).toContain(
      '<img src="https://cdn.example.com/qr-1.png" alt="" width="120" height="120"',
    );
  });

  it('作成後に内容を変えると作り直しを促し、書き出しで警告する', async () => {
    const hook = vi.fn(async () => 'https://cdn.example.com/qr-2.png');
    const { el } = await openQr({ content: 'https://example.com/a' }, { onImageUpload: hook });
    /** @type {HTMLButtonElement} */ (generateButton(el)).click();
    await settle();
    expect(deep(el, 'mm-settings-panel', '.qr .warning')).toBeNull();

    const textarea = /** @type {HTMLTextAreaElement} */ (
      deep(el, 'mm-settings-panel', '[data-key="content"] textarea')
    );
    typeInto(textarea, 'https://example.com/b');
    await frame();
    expect(deep(el, 'mm-settings-panel', '.qr .warning')?.textContent).toContain('作り直す');
    const block = canvasBlocks(el)[0];
    expect(block.shadowRoot?.querySelector('.badge.warn')?.textContent).toBe('要作り直し');

    const warned = once(el, 'mm-warning');
    el.exportHtml();
    expect(/** @type {CustomEvent} */ (await warned).detail.code).toBe('qr-stale');

    /** @type {HTMLButtonElement} */ (generateButton(el)).click();
    await settle();
    expect(hook).toHaveBeenCalledTimes(2);
    expect(deep(el, 'mm-settings-panel', '.qr .warning')).toBeNull();
    expect(block.shadowRoot?.querySelector('.badge.warn')).toBeNull();
  });

  it('未作成の QR は書き出しで警告する', async () => {
    const { el } = await openQr(
      { content: 'https://example.com/' },
      { onImageUpload: async () => 'https://cdn.example.com/qr.png' },
    );
    const warned = once(el, 'mm-warning');
    const html = el.exportHtml();
    expect(/** @type {CustomEvent} */ (await warned).detail.code).toBe('qr-missing');
    expect(html).not.toContain('<img');
  });

  it('長すぎる内容は作らずにエラーを出す', async () => {
    const hook = vi.fn(async () => 'https://cdn.example.com/qr.png');
    const { el } = await openQr(
      { content: 'あ'.repeat(1500), ecLevel: 'H' },
      { onImageUpload: hook },
    );
    const warned = once(el, 'mm-warning');
    /** @type {HTMLButtonElement} */ (generateButton(el)).click();
    expect(/** @type {CustomEvent} */ (await warned).detail.code).toBe('qr-too-long');
    await frame();
    expect(hook).not.toHaveBeenCalled();
    expect(deep(el, 'mm-settings-panel', '.qr .error')?.textContent).toContain('長すぎ');
    expect(qrValues(el).src).toBe('');
  });
});
