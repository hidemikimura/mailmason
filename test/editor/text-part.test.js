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
      '指定の文',
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

describe('指定の文と参照', () => {
  /** @param {Record<string, unknown>} [props] */
  async function withButton(props = {}) {
    const el = await mount({
      mergeTags: [{ key: 'name', label: '氏名' }],
      ...props,
    });
    const template = createTemplate();
    const button = createBlock('button', {
      label: 'パスワードを設定する',
      href: 'https://example.com/reset',
    });
    button.id = 'b_button0001';
    template.body.rows.push(createRow('1', [[button]]));
    el.loadJson(template);
    el.select(button.id);
    await frame();
    return el;
  }

  /** @param {MailmasonEditor} el */
  const contentInput = (el) =>
    /** @type {any} */ (deep(el, 'mm-settings-panel', '[data-key="content"] mm-text-input'));

  it('「指定の文」は {@text} から始め、参照の名前をボタンで入れられ、値の変更を追いかける', async () => {
    const el = await withButton();
    segments(textField(el))[3].click();
    await frame();
    expect(blockOf(el, 'b_button0001')?.text).toMatchObject({ mode: 'custom', content: '{@text}' });
    expect(el.exportText()).toBe('▶ パスワードを設定する\n  https://example.com/reset');

    const input = contentInput(el);
    const textarea = /** @type {HTMLTextAreaElement} */ (input.querySelector('textarea'));
    const refs = [
      .../** @type {HTMLElement} */ (deep(el, 'mm-settings-panel', '.refs')).querySelectorAll(
        'button',
      ),
    ].map((b) => /** @type {HTMLElement} */ (b).dataset.ref);
    expect(refs).toEqual(['text', 'label', 'href']);

    textarea.focus();
    textarea.value = '{{氏名}} 様、次の URL から設定してください：\n';
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    /** @type {HTMLButtonElement} */ (
      deep(el, 'mm-settings-panel', '.refs button[data-ref="href"]')
    ).click();
    await frame();
    expect(blockOf(el, 'b_button0001')?.text?.content).toBe(
      '{{name}} 様、次の URL から設定してください：\n{@href}',
    );
    expect(blockBadges(el, 0)).toEqual(['テキストを指定']);

    el.select('b_button0001');
    /** @type {any} */ (el).store.dispatch({
      type: 'updateBlockValues',
      blockId: 'b_button0001',
      patch: { href: 'https://example.com/reset2' },
    });
    await frame();
    /** @type {string[]} */
    const codes = [];
    el.addEventListener('mm-warning', (e) => codes.push(/** @type {any} */ (e).detail.code));
    expect(el.exportText()).toBe(
      '{{name}} 様、次の URL から設定してください：\nhttps://example.com/reset2',
    );
    expect(codes).toEqual([]);
  });

  it('参照を含まない文は、部品が変わると印と案内を出し、確認済みにすると消える', async () => {
    const el = await withButton();
    segments(textField(el))[3].click();
    await frame();
    const textarea = contentInput(el).querySelector('textarea');
    textarea.value = '固定の案内です';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await frame();
    expect(deep(el, 'mm-settings-panel', '.stale')).toBeNull();

    /** @type {any} */ (el).store.dispatch({
      type: 'updateBlockValues',
      blockId: 'b_button0001',
      patch: { label: '変えたラベル' },
    });
    await frame();
    expect(deep(el, 'mm-settings-panel', '.stale')).not.toBeNull();
    expect(blockBadges(el, 0)).toEqual(['テキストが古い']);
    /** @type {any[]} */
    const warnings = [];
    el.addEventListener('mm-warning', (e) => warnings.push(/** @type {any} */ (e).detail));
    el.exportText();
    expect(warnings).toContainEqual(
      expect.objectContaining({ code: 'stale-text', blockIds: ['b_button0001'] }),
    );

    /** @type {HTMLButtonElement} */ (
      deep(el, 'mm-settings-panel', '[data-action="acknowledge-text"]')
    ).click();
    await frame();
    expect(deep(el, 'mm-settings-panel', '.stale')).toBeNull();
    expect(blockBadges(el, 0)).toEqual(['テキストを指定']);
  });

  it('その部品に無い名前は設定欄で知らせ、書き出しで unknown-text-ref を出す', async () => {
    const el = await withButton();
    segments(textField(el))[3].click();
    await frame();
    const textarea = contentInput(el).querySelector('textarea');
    textarea.value = '{@label} {@alt}';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await frame();
    expect(deep(el, 'mm-settings-panel', '[data-key="content"] .warning')?.textContent).toContain(
      '{@alt}',
    );
    /** @type {any[]} */
    const warnings = [];
    el.addEventListener('mm-warning', (e) => warnings.push(/** @type {any} */ (e).detail));
    expect(el.exportText()).toBe('パスワードを設定する {@alt}');
    expect(warnings).toContainEqual(
      expect.objectContaining({ code: 'unknown-text-ref', blockId: 'b_button0001', name: 'alt' }),
    );
  });

  it('textOptions.textTemplates で種類ごとの書き方を決められ、設定欄の見本にも出る', async () => {
    const el = await withButton({
      textOptions: { textTemplates: { button: '{@label}：{@href}' } },
    });
    expect(el.exportText()).toBe('パスワードを設定する：https://example.com/reset');
    expect(deep(el, 'mm-settings-panel', '.text-preview pre')?.textContent).toBe(
      'パスワードを設定する：https://example.com/reset',
    );
  });
});

describe('全文の手直しと本文の差分', () => {
  async function editing() {
    const el = await mount();
    const template = createTemplate();
    const text = createBlock('text', { html: '<p>秋の新作です</p><p>送料は 500 円です</p>' });
    text.id = 'b_text00001';
    template.body.rows.push(createRow('1', [[text]]));
    el.loadJson(template);
    el.view = 'preview';
    await frame();
    const root = /** @type {any} */ (deep(el, 'mm-preview')).shadowRoot;
    root.querySelector('[data-tab="text"]').click();
    await frame();
    root.querySelector('[data-action="edit-text"]').click();
    await frame();
    root.querySelector('[data-action="confirm-edit-text"]').click();
    await frame();
    /** @param {string} html */
    const changeBody = async (html) => {
      /** @type {any} */ (el).store.dispatch({
        type: 'updateBlockValues',
        blockId: 'b_text00001',
        patch: { html },
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      await frame();
    };
    /** @param {string} content */
    const setContent = async (content) => {
      /** @type {any} */ (el).store.dispatch({ type: 'setTextPart', content });
      await frame();
    };
    return { el, root, changeBody, setContent };
  }

  it('手直しを始めた時点の自動生成を sourceText に残す', async () => {
    const { el } = await editing();
    const { text } = el.getJson();
    expect(text.mode).toBe('manual');
    expect(text.sourceText).toBe('秋の新作です\n\n送料は 500 円です');
    expect(text.content).toBe(text.sourceText);
  });

  it('本文が変わると差分を見せ、取り込むと手直しの文に入り、全部取り込むと警告が消える', async () => {
    const { el, root, changeBody, setContent } = await editing();
    await setContent('いつもありがとうございます\n\n秋の新作です\n\n送料は 500 円です');
    await changeBody('<p>冬の新作です</p><p>送料は無料です</p>');

    expect(root.querySelector('.notice[role="alert"]')).not.toBeNull();
    expect(root.querySelector('.diff-summary').textContent).toContain('+2 行 / −2 行');
    const hunks = root.querySelectorAll('.hunk');
    expect(hunks).toHaveLength(2);
    expect(hunks[0].querySelector('del').textContent).toBe('秋');
    expect(hunks[0].querySelector('ins').textContent).toBe('冬');

    /** @type {any[]} */
    const warnings = [];
    el.addEventListener('mm-warning', (e) => warnings.push(/** @type {any} */ (e).detail));
    el.exportText();
    expect(warnings).toContainEqual(
      expect.objectContaining({ code: 'stale-text', added: 2, removed: 2 }),
    );

    hunks[0].querySelector('[data-action="import-hunk"]').click();
    await frame();
    expect(el.getJson().text.content).toBe(
      'いつもありがとうございます\n\n冬の新作です\n\n送料は 500 円です',
    );
    expect(root.querySelectorAll('.hunk')).toHaveLength(1);
    expect(root.querySelector('.notice[role="alert"]')).not.toBeNull();

    root.querySelector('.hunk [data-action="import-hunk"]').click();
    await frame();
    expect(el.getJson().text.content).toBe(
      'いつもありがとうございます\n\n冬の新作です\n\n送料は無料です',
    );
    expect(root.querySelector('.notice[role="alert"]')).toBeNull();
    expect(root.querySelector('.diff')).toBeNull();

    el.undo();
    await frame();
    expect(root.querySelectorAll('.hunk')).toHaveLength(1);
  });

  it('手直しの文に変わる前の行が無ければ取り込めない。確認済みにすると差分も消える', async () => {
    const { el, root, changeBody, setContent } = await editing();
    await setContent('すっかり書き換えた文');
    await changeBody('<p>冬の新作です</p><p>送料は 500 円です</p>');
    const button = root.querySelector('.hunk [data-action="import-hunk"]');
    expect(button.disabled).toBe(true);
    root.querySelector('[data-action="acknowledge"]').click();
    await frame();
    expect(root.querySelector('.diff')).toBeNull();
    expect(el.getJson().text.sourceText).toBe('冬の新作です\n\n送料は 500 円です');
    expect(el.getJson().text.content).toBe('すっかり書き換えた文');
  });

  it('sourceText の無い古いテンプレートは、古いとだけ出す', async () => {
    const { el, root, changeBody } = await editing();
    const json = el.getJson();
    delete json.text.sourceText;
    el.loadJson(json);
    await frame();
    await changeBody('<p>冬の新作です</p>');
    expect(root.querySelector('.notice[role="alert"]')).not.toBeNull();
    expect(root.querySelector('.diff')).toBeNull();
  });
});
