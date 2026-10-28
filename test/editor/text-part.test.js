// テキストパートでの部品・行の扱い（設定欄・キャンバスの印）、textOptions、全文編集の前の案内
import { afterEach, describe, expect, it } from 'vitest';
import { createBlock, createRow, createTemplate } from '../../src/index.js';
import { deep, frame, mount } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

/** @param {Record<string, unknown>} [props] */
async function setup(props = {}) {
  const el = await mount(props);
  const template = createTemplate();
  const text = createBlock('text', { html: '<p>本文です</p>' });
  text.id = 'b_text00001';
  const logo = createBlock('image', { src: 'https://example.com/logo.png', alt: 'ショップ' });
  logo.id = 'b_logo00001';
  const mobile = { ...createBlock('text', { html: '<p>スマホ用の案内</p>' }), hideOn: 'desktop' };
  mobile.id = 'b_mobile0001';
  const row = createRow('1', [[logo, text, mobile]]);
  row.id = 'r_row000001';
  const footer = createRow('1', [[createBlock('text', { html: '<p>フッター</p>' })]]);
  footer.id = 'r_footer0001';
  template.body.rows.push(row, footer);
  el.loadJson(template);
  await frame();
  return el;
}

/** @param {MailmasonEditor} el */
const textField = (el) =>
  /** @type {HTMLElement} */ (deep(el, 'mm-settings-panel', '[data-key="mode"]'));

/** @param {HTMLElement} f */
const segments = (f) =>
  /** @type {HTMLButtonElement[]} */ ([...f.querySelectorAll('.segmented button')]);

/** @param {MailmasonEditor} el @param {string} id */
const blockOf = (el, id) =>
  el
    .getJson()
    .body.rows.flatMap((row) => row.columns.flatMap((column) => column.blocks))
    .find((block) => block.id === id);

/**
 * キャンバスの部品・行の印
 * @param {MailmasonEditor} el
 * @param {number} index 部品の位置（1 行目）
 */
const blockBadges = (el, index) => {
  const blocks = /** @type {any} */ (deep(el, 'mm-canvas', 'mm-row')).shadowRoot.querySelectorAll(
    'mm-block',
  );
  return [...blocks[index].shadowRoot.querySelectorAll('.badge')].map((b) => b.textContent.trim());
};

describe('設定欄の「テキストパート」', () => {
  it('部品を「出さない」「テキストだけ」にでき、印を出し、元に戻せる', async () => {
    const el = await setup();
    el.select('b_logo00001');
    await frame();
    const f = textField(el);
    expect(segments(f).map((b) => b.textContent?.trim())).toEqual([
      '自動',
      '出さない',
      'テキストだけ',
    ]);
    expect(segments(f)[0].getAttribute('aria-pressed')).toBe('true');
    // 「自動」のときは、この部品から作られるテキストを見せる
    const preview = deep(el, 'mm-settings-panel', '.text-preview pre');
    expect(preview?.textContent).toBe('[ショップ]');

    segments(f)[1].click();
    await frame();
    expect(blockOf(el, 'b_logo00001')?.text).toEqual({ mode: 'hidden' });
    expect(blockBadges(el, 0)).toEqual(['テキストに出さない']);
    expect(el.exportText()).not.toContain('ショップ');
    expect(el.exportHtml()).toContain('logo.png');

    el.select('b_text00001');
    await frame();
    segments(textField(el))[2].click();
    await frame();
    expect(blockOf(el, 'b_text00001')?.text).toEqual({ mode: 'only' });
    expect(blockBadges(el, 1)).toEqual(['テキストだけ']);
    expect(el.exportText()).toContain('本文です');
    expect(el.exportHtml()).not.toContain('本文です');
    // キャンバスには出したまま（直せるように）
    expect(
      /** @type {any} */ (deep(el, 'mm-canvas', 'mm-row')).shadowRoot.querySelectorAll(
        'mm-block',
      )[1].shadowRoot.textContent,
    ).toContain('本文です');

    segments(textField(el))[0].click();
    await frame();
    expect(blockOf(el, 'b_text00001')).not.toHaveProperty('text');
    el.undo();
    await frame();
    expect(blockOf(el, 'b_text00001')?.text).toEqual({ mode: 'only' });
  });

  it('行は「自動」「行ごと出さない」から選び、中の部品の設定より先に効く', async () => {
    const el = await setup();
    el.select('r_row000001');
    await frame();
    const f = textField(el);
    expect(segments(f).map((b) => b.textContent?.trim())).toEqual(['自動', '行ごと出さない']);
    segments(f)[1].click();
    await frame();
    expect(el.getJson().body.rows[0].text).toEqual({ mode: 'hidden' });
    expect(
      [
        .../** @type {any} */ (deep(el, 'mm-canvas', 'mm-row')).shadowRoot.querySelectorAll(
          '.badges .badge',
        ),
      ].map((b) => b.textContent.trim()),
    ).toEqual(['テキストに出さない']);
    expect(el.exportText()).toBe('フッター');
  });
});

describe('textOptions', () => {
  it('textVariant を渡すと、exportText とプレビューで PC 側だけを出す', async () => {
    const el = await setup({ textOptions: { textVariant: 'desktop' } });
    expect(el.exportText()).not.toContain('スマホ用の案内');
    el.textOptions = {};
    await frame();
    expect(el.exportText()).toContain('スマホ用の案内');

    el.textOptions = { textVariant: 'desktop', headingPrefix: '■ ' };
    el.view = 'preview';
    await frame();
    const preview = /** @type {any} */ (deep(el, 'mm-preview'));
    preview.shadowRoot.querySelector('[data-tab="text"]').click();
    await frame();
    const pre = preview.shadowRoot.querySelector('pre');
    expect(pre.textContent).toContain('本文です');
    expect(pre.textContent).not.toContain('スマホ用の案内');
  });

  it('手直しの古さの判定にも同じ設定を使う', async () => {
    const el = await setup({ textOptions: { textVariant: 'desktop' } });
    el.view = 'preview';
    await frame();
    const preview = /** @type {any} */ (deep(el, 'mm-preview'));
    preview.shadowRoot.querySelector('[data-tab="text"]').click();
    await frame();
    preview.shadowRoot.querySelector('[data-action="edit-text"]').click();
    await frame();
    preview.shadowRoot.querySelector('[data-action="confirm-edit-text"]').click();
    await frame();
    /** @type {string[]} */
    const codes = [];
    el.addEventListener('mm-warning', (e) => codes.push(/** @type {any} */ (e).detail.code));
    el.exportText();
    expect(codes).not.toContain('stale-text');
    expect(preview.shadowRoot.querySelector('.notice[role="alert"]')).toBeNull();
  });
});

describe('全文編集の前の案内', () => {
  /** @param {MailmasonEditor} el */
  async function openText(el) {
    el.view = 'preview';
    await frame();
    const preview = /** @type {any} */ (deep(el, 'mm-preview'));
    preview.shadowRoot.querySelector('[data-tab="text"]').click();
    await frame();
    return preview.shadowRoot;
  }

  it('「編集する」で案内を出し、キャンセルなら自動のまま、確定で全文編集にする', async () => {
    const el = await setup();
    const root = await openText(el);
    root.querySelector('[data-action="edit-text"]').click();
    await frame();
    const notice = root.querySelector('.notice.confirm');
    expect(notice?.textContent).toContain('テキストパート');
    expect(el.getJson().text.mode).toBe('auto');

    root.querySelector('[data-action="cancel-edit-text"]').click();
    await frame();
    expect(root.querySelector('.notice.confirm')).toBeNull();
    expect(el.getJson().text.mode).toBe('auto');

    root.querySelector('[data-action="edit-text"]').click();
    await frame();
    root.querySelector('[data-action="confirm-edit-text"]').click();
    await frame();
    expect(el.getJson().text.mode).toBe('manual');
    expect(root.querySelector('.notice.confirm')).toBeNull();
  });

  it('textEditConfirm を false にすると案内を出さない（属性 text-edit-confirm="false"）', async () => {
    const el = await setup();
    el.setAttribute('text-edit-confirm', 'false');
    expect(el.textEditConfirm).toBe(false);
    const root = await openText(el);
    root.querySelector('[data-action="edit-text"]').click();
    await frame();
    expect(root.querySelector('.notice.confirm')).toBeNull();
    expect(el.getJson().text.mode).toBe('manual');
  });
});
