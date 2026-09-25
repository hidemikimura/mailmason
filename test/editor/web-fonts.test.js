// Web フォント: 全体設定での登録、フォントの選択（全体・テキストブロック）、キャンバスでの読み込み、プレビュー
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlock, createRow, createTemplate } from '../../src/index.js';
import { DEFAULT_WEB_FONT_OPTIONS } from '../../src/editor/web-fonts.js';
import { deep, frame, mount, typeInto } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

// テストでは外部に取りに行かない URL を使う
const OPTIONS = [
  {
    family: 'Test Sans',
    url: 'https://fonts.example.com/css?family=Test+Sans',
    fallback: 'Arial, sans-serif',
    group: { ja: 'サンセリフ', en: 'Sans' },
  },
  { family: 'Test Serif', url: 'https://fonts.example.com/css?family=Test+Serif' },
];

afterEach(() => {
  document.body.innerHTML = '';
});

async function setup() {
  const el = await mount({ webFontOptions: OPTIONS });
  const template = createTemplate();
  const text = createBlock('text', { html: '<p>本文</p>' });
  text.id = 'b_text00001';
  template.body.rows.push(createRow('1', [[text]]));
  el.loadJson(template);
  el.select(null);
  await frame();
  return el;
}

/** @param {MailmasonEditor} el @param {string} key */
const field = (el, key) =>
  /** @type {HTMLElement} */ (deep(el, 'mm-settings-panel', `[data-key="${key}"]`));

/**
 * @param {HTMLSelectElement} select
 * @param {string} value
 */
function choose(select, value) {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

/** @param {MailmasonEditor} el */
const addSelect = (el) =>
  /** @type {HTMLSelectElement} */ (
    field(el, 'webFonts').querySelector('[data-action="add-web-font"]')
  );

/** @param {MailmasonEditor} el */
const fontSelect = (el) =>
  /** @type {HTMLSelectElement} */ (field(el, 'fontFamily').querySelector('[data-action="font"]'));

/** document に読み込んだ Web フォントの CSS */
const documentLinks = () =>
  [...document.head.querySelectorAll('link[data-mailmason-web-font]')].map((link) =>
    link.getAttribute('href'),
  );

describe('Web フォント', () => {
  it('既定の候補は Google Fonts（日本語のゴシック体・明朝体と欧文）', () => {
    const families = DEFAULT_WEB_FONT_OPTIONS.map((option) => option.family);
    expect(families).toContain('Noto Sans JP');
    expect(families).toContain('Noto Serif JP');
    expect(families).toContain('Roboto');
    for (const option of DEFAULT_WEB_FONT_OPTIONS) {
      expect(option.url).toMatch(
        /^https:\/\/fonts\.googleapis\.com\/css2\?family=[\w+]+(:wght@400;700)?&display=swap$/,
      );
      expect(option.fallback).toMatch(/(sans-serif|serif)$/);
    }
  });

  it('候補から追加し、フォントで選ぶ。キャンバス用に document に読み込み、書き出しの head にも入る', async () => {
    const el = await setup();
    const options = [...addSelect(el).querySelectorAll('option')].map((o) => o.textContent?.trim());
    expect(options).toEqual(['Web フォントを追加…', 'Test Sans', 'Test Serif', 'URL を指定…']);
    expect(addSelect(el).querySelector('optgroup')?.getAttribute('label')).toBe('サンセリフ');
    // 登録していなければ、フォントの一覧には出ない
    expect(fontSelect(el).textContent).toContain('全体設定で Web フォントを追加');

    choose(addSelect(el), '0');
    await frame();
    expect(el.getJson().body.settings.webFonts).toEqual([
      { family: 'Test Sans', url: OPTIONS[0].url },
    ]);
    expect(documentLinks()).toContain(OPTIONS[0].url);
    // 追加したフォントは候補から消える
    expect(addSelect(el).textContent).not.toContain('Test Sans');
    // まだ使っていないので、書き出しでは読み込まない
    expect(el.exportHtml()).not.toContain('fonts.example.com');

    choose(fontSelect(el), 'web:Test Sans');
    await frame();
    expect(el.getJson().body.settings.fontFamily).toBe("'Test Sans', Arial, sans-serif");
    expect(field(el, 'fontFamily').querySelector('[data-help="web-font"]')?.textContent).toContain(
      'Arial, sans-serif',
    );
    const html = el.exportHtml();
    expect(html).toContain(
      '<link href="https://fonts.example.com/css?family=Test+Sans" rel="stylesheet" type="text/css" />',
    );
    // キャンバスの文字もそのフォント
    const content = /** @type {HTMLElement} */ (
      deep(el, 'mm-canvas', 'mm-row', 'mm-block', '.content')
    );
    expect(content.innerHTML).toContain('Test Sans');

    // 外すと document からも外す
    /** @type {HTMLButtonElement} */ (
      field(el, 'webFonts').querySelector('[data-action="remove-web-font"]')
    ).click();
    await frame();
    expect(el.getJson().body.settings.webFonts).toEqual([]);
    expect(documentLinks()).not.toContain(OPTIONS[0].url);
    expect(el.exportHtml()).not.toContain('fonts.example.com');
  });

  it('URL を指定して追加する（https 以外・名前なし・重複は追加しない）', async () => {
    const el = await setup();
    choose(addSelect(el), '__custom');
    await frame();
    const root = field(el, 'webFonts');
    const family = /** @type {HTMLInputElement} */ (root.querySelector('[data-input="family"]'));
    const url = /** @type {HTMLInputElement} */ (root.querySelector('[data-input="url"]'));
    const add = /** @type {HTMLButtonElement} */ (
      root.querySelector('[data-action="add-custom-web-font"]')
    );
    family.value = '社内フォント';
    url.value = 'http://cdn.example.com/font.css';
    add.click();
    await frame();
    expect(root.querySelector('.error')?.textContent).toContain('https://');
    expect(el.getJson().body.settings.webFonts).toEqual([]);

    url.value = 'https://cdn.example.com/font.css';
    add.click();
    await frame();
    expect(el.getJson().body.settings.webFonts).toEqual([
      { family: '社内フォント', url: 'https://cdn.example.com/font.css' },
    ]);
    expect(root.querySelector('[data-input="family"]')).toBeNull();
    expect(root.querySelector('.web-font')?.textContent).toContain('cdn.example.com');
  });

  it('テキストブロック: 全体設定に従う・端末のフォント・登録した Web フォント・直接入力', async () => {
    const el = await setup();
    choose(addSelect(el), '1');
    await frame();
    el.select('b_text00001');
    await frame();
    const values = () => /** @type {any} */ (el.getJson().body.rows[0].columns[0].blocks[0].values);
    expect(fontSelect(el).value).toBe('__inherit');

    choose(fontSelect(el), 'web:Test Serif');
    await frame();
    // 候補に後ろのフォントが無ければ日本語のゴシック体
    expect(values().fontFamily).toBe(
      "'Test Serif', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif",
    );
    expect(el.exportHtml()).toContain('Test+Serif');

    choose(fontSelect(el), 'system:1');
    await frame();
    expect(values().fontFamily).toContain('Mincho');
    expect(el.exportHtml()).not.toContain('Test+Serif');

    choose(fontSelect(el), '__custom');
    await frame();
    const input = /** @type {HTMLInputElement} */ (
      field(el, 'fontFamily').querySelector('[data-input="font-family"]')
    );
    expect(input.value).toContain('Mincho');
    typeInto(input, 'Verdana, sans-serif');
    await frame();
    expect(values().fontFamily).toBe('Verdana, sans-serif');

    choose(fontSelect(el), '__inherit');
    await frame();
    expect(values().fontFamily).toBeNull();
  });

  it('webFontOptions を空にすると、URL の指定だけになる', async () => {
    const el = await mount({ webFontOptions: [] });
    el.select(null);
    await frame();
    const options = [...addSelect(el).querySelectorAll('option')].map((o) => o.textContent?.trim());
    expect(options).toEqual(['Web フォントを追加…', 'URL を指定…']);
  });

  it('プレビュー: Web フォントを使っているときだけ切り替えを出し、オフで読み込まない', async () => {
    const el = await setup();
    el.view = 'preview';
    await frame();
    expect(deep(el, 'mm-preview', '[data-action="web-fonts"]')).toBeNull();

    el.view = 'edit';
    await frame();
    el.select(null);
    await frame();
    choose(addSelect(el), '0');
    await frame();
    choose(fontSelect(el), 'web:Test Sans');
    await frame();
    el.view = 'preview';
    await frame();
    const iframe = /** @type {HTMLIFrameElement} */ (deep(el, 'mm-preview', 'iframe'));
    await vi.waitFor(() => expect(iframe.srcdoc).toContain('fonts.example.com'));
    const check = /** @type {HTMLInputElement} */ (
      deep(el, 'mm-preview', '[data-action="web-fonts"]')
    );
    expect(check.checked).toBe(true);
    check.checked = false;
    check.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(iframe.srcdoc).not.toContain('fonts.example.com'));
    // 書き出しには影響しない
    expect(el.exportHtml()).toContain('fonts.example.com');
  });
});
