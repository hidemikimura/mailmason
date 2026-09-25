// スマホ向けの設定: 表示する画面（すべて / PC だけ / スマホだけ）とスマホの文字サイズ
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlock, createRow, createTemplate } from '../../src/index.js';
import { deep, frame, mount, typeInto } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

async function setup() {
  const el = await mount();
  const template = createTemplate();
  const text = createBlock('text', { html: '<h2>見出し</h2><p>本文</p>' });
  text.id = 'b_text00001';
  const button = createBlock('button', { label: '購入する', href: 'https://example.com/' });
  button.id = 'b_button0001';
  const row = createRow('1', [[text, button]]);
  row.id = 'r_row000001';
  template.body.rows.push(row);
  el.loadJson(template);
  await frame();
  return el;
}

/** @param {MailmasonEditor} el @param {string} key */
const field = (el, key) =>
  /** @type {HTMLElement} */ (deep(el, 'mm-settings-panel', `[data-key="${key}"]`));

/** @param {HTMLElement} f */
const segments = (f) =>
  /** @type {HTMLButtonElement[]} */ ([...f.querySelectorAll('.segmented button')]);

describe('表示する画面', () => {
  it('ブロック: 「スマホだけ」にすると PC で隠し、注意とバッジを出す', async () => {
    const el = await setup();
    el.select('b_text00001');
    await frame();
    const f = field(el, 'hideOn');
    expect(segments(f).map((b) => b.textContent?.trim())).toEqual([
      'すべて',
      'PC だけ',
      'スマホだけ',
    ]);
    expect(segments(f)[0].getAttribute('aria-pressed')).toBe('true');
    expect(f.querySelector('.help')).toBeNull();

    segments(f)[2].click();
    await frame();
    const block = el.getJson().body.rows[0].columns[0].blocks[0];
    expect(block.hideOn).toBe('desktop');
    expect(field(el, 'hideOn').querySelector('.help')?.textContent).toContain('Outlook');
    const badge = deep(el, 'mm-canvas', 'mm-row', 'mm-block', '.badge');
    expect(badge?.textContent?.trim()).toBe('PC 非表示');
    expect(el.exportHtml()).toContain(
      '<tr class="mm-hide-desktop" style="display:none;mso-hide:all;">',
    );

    segments(field(el, 'hideOn'))[1].click();
    await frame();
    expect(el.getJson().body.rows[0].columns[0].blocks[0].hideOn).toBe('mobile');
    expect(deep(el, 'mm-canvas', 'mm-row', 'mm-block', '.badge')?.textContent?.trim()).toBe(
      'スマホ非表示',
    );
    el.undo();
    el.undo();
    await frame();
    expect(el.getJson().body.rows[0].columns[0].blocks[0].hideOn).toBeNull();
  });

  it('行: 「スマホだけ」を選べる', async () => {
    const el = await setup();
    el.select('r_row000001');
    await frame();
    segments(field(el, 'hideOn'))[2].click();
    await frame();
    expect(el.getJson().body.rows[0].settings.hideOn).toBe('desktop');
    expect(deep(el, 'mm-canvas', 'mm-row', '.badge')?.textContent?.trim()).toBe('PC 非表示');
  });
});

describe('スマホの文字サイズ', () => {
  it('メール全体とブロックに設定でき、スマホのプレビューで大きさが変わる', async () => {
    const el = await setup();
    el.select(null);
    await frame();
    const bodyField = field(el, 'mobileFontSize');
    expect(bodyField.textContent).toContain('PC と同じ');
    typeInto(/** @type {HTMLInputElement} */ (bodyField.querySelector('input')), '18');
    await frame();
    expect(el.getJson().body.settings.mobileFontSize).toBe(18);

    el.select('b_button0001');
    await frame();
    typeInto(
      /** @type {HTMLInputElement} */ (field(el, 'mobileFontSize').querySelector('input')),
      '20',
    );
    await frame();
    expect(el.getJson().body.rows[0].columns[0].blocks[1].values.mobileFontSize).toBe(20);
    // 空欄に戻すと null
    typeInto(
      /** @type {HTMLInputElement} */ (field(el, 'mobileFontSize').querySelector('input')),
      '',
    );
    await frame();
    expect(el.getJson().body.rows[0].columns[0].blocks[1].values.mobileFontSize).toBeNull();
    typeInto(
      /** @type {HTMLInputElement} */ (field(el, 'mobileFontSize').querySelector('input')),
      '20',
    );
    await frame();

    el.previewDevice = 'mobile';
    el.view = 'preview';
    await frame();
    const iframe = /** @type {HTMLIFrameElement} */ (deep(el, 'mm-preview', 'iframe'));
    await vi.waitFor(() => expect(iframe.contentDocument?.querySelector('p')).not.toBeNull());
    const doc = /** @type {Document} */ (iframe.contentDocument);
    const win = /** @type {Window} */ (iframe.contentWindow);
    const size = (/** @type {string} */ selector) =>
      win.getComputedStyle(/** @type {Element} */ (doc.querySelector(selector))).fontSize;
    await vi.waitFor(() => expect(size('p')).toBe('18px'));
    expect(size('h2')).toBe('25px'); // 18 × 1.4
    expect(size('a[target="_blank"][class]')).toBe('20px');
    el.previewDevice = 'desktop';
    await vi.waitFor(() => expect(size('p')).toBe('16px'));
    expect(size('a[target="_blank"][class]')).toBe('16px');
  });
});
