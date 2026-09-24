import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasBlocks, deep, fixtures, frame, mount, press } from './helpers.js';
import { NARROW_WIDTH } from '../../src/editor/mailmason-editor.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

/**
 * 幅を指定して表示する
 * @param {number} width
 */
async function mountWidth(width) {
  const el = await mount();
  el.style.width = `${width}px`;
  el.loadJson(fixtures.basic);
  await vi.waitFor(() => expect(el.hasAttribute('narrow')).toBe(width < NARROW_WIDTH));
  await frame();
  return el;
}

/**
 * @param {MailmasonEditor} el
 * @param {string} selector
 */
const shown = (el, selector) => {
  const node = /** @type {HTMLElement} */ (el.shadowRoot?.querySelector(selector));
  return getComputedStyle(node).display !== 'none';
};

/**
 * @param {MailmasonEditor} el
 * @param {'palette' | 'settings'} name
 */
async function toggle(el, name) {
  /** @type {HTMLButtonElement} */ (deep(el, 'mm-toolbar', `[data-drawer="${name}"]`)).click();
  await frame();
}

describe(`狭い画面（${NARROW_WIDTH}px 未満）`, () => {
  it('広い画面ではパレット・キャンバス・設定パネルを並べる', async () => {
    const el = await mountWidth(1200);
    expect(shown(el, 'mm-palette')).toBe(true);
    expect(shown(el, 'mm-settings-panel')).toBe(true);
    expect(deep(el, 'mm-toolbar', '[data-drawer="palette"]')).toBeNull();
  });

  it('狭い画面ではキャンバスだけを出し、ツールバーからパネルを重ねて開く', async () => {
    const el = await mountWidth(800);
    expect(shown(el, 'mm-palette')).toBe(false);
    expect(shown(el, 'mm-settings-panel')).toBe(false);
    const canvas = /** @type {HTMLElement} */ (deep(el, 'mm-canvas'));
    expect(canvas.getBoundingClientRect().width).toBeGreaterThan(700);

    await toggle(el, 'palette');
    expect(shown(el, 'mm-palette')).toBe(true);
    expect(getComputedStyle(/** @type {Element} */ (deep(el, 'mm-palette'))).position).toBe(
      'absolute',
    );
    expect(deep(el, 'mm-toolbar', '[data-drawer="palette"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );

    // 設定を開くとパレットは閉じる（同時に開くのは 1 つ）
    await toggle(el, 'settings');
    expect(shown(el, 'mm-palette')).toBe(false);
    expect(shown(el, 'mm-settings-panel')).toBe(true);
    await toggle(el, 'settings');
    expect(shown(el, 'mm-settings-panel')).toBe(false);
  });

  it('パレットから追加したら、結果が見えるようにパレットを閉じる', async () => {
    const el = await mountWidth(800);
    await toggle(el, 'palette');
    /** @type {HTMLElement} */ (deep(el, 'mm-palette', '[data-block-type="text"]')).click();
    await frame();
    expect(el.getJson().body.rows).toHaveLength(5);
    expect(shown(el, 'mm-palette')).toBe(false);
  });

  it('Esc で開いているパネルを閉じる（選択は残す）', async () => {
    const el = await mountWidth(800);
    el.select('b_button01');
    await toggle(el, 'settings');
    press(el, 'Escape');
    await frame();
    expect(shown(el, 'mm-settings-panel')).toBe(false);
    expect(el.store.getState().selection).toBe('b_button01');
  });

  it('ドラッグを始めたらパレットを閉じる', async () => {
    const el = await mountWidth(800);
    await toggle(el, 'palette');
    const item = /** @type {HTMLElement} */ (deep(el, 'mm-palette', '[data-block-type="text"]'));
    const r = item.getBoundingClientRect();
    const init = { bubbles: true, composed: true, button: 0, buttons: 1, pointerId: 1 };
    item.dispatchEvent(
      new PointerEvent('pointerdown', { ...init, clientX: r.left + 5, clientY: r.top + 5 }),
    );
    window.dispatchEvent(
      new PointerEvent('pointermove', { ...init, clientX: r.left + 60, clientY: r.top + 60 }),
    );
    await frame();
    expect(shown(el, 'mm-palette')).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
    await frame();
  });

  it('広い画面に戻したらパネルを並べて表示する', async () => {
    const el = await mountWidth(800);
    await toggle(el, 'settings');
    el.style.width = '1200px';
    await vi.waitFor(() => expect(el.hasAttribute('narrow')).toBe(false));
    await frame();
    expect(shown(el, 'mm-palette')).toBe(true);
    expect(shown(el, 'mm-settings-panel')).toBe(true);
    expect(canvasBlocks(el).length).toBeGreaterThan(0);
  });
});
