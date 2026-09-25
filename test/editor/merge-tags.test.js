import { afterEach, describe, expect, it } from 'vitest';
import { createBlock, createRow, createTemplate } from '../../src/index.js';
import { filterMergeTags, findMergeTagTrigger } from '../../src/editor/merge-tag-search.js';
import { canvasBlocks, deep, fixtures, frame, mount, press } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

const TAGS = [
  { key: 'name', label: '氏名', group: '会員', sample: '山田 太郎' },
  { key: 'points', label: '保有ポイント', group: '会員' },
  { key: 'coupon', label: 'クーポンコード', group: 'クーポン' },
  { key: 'coupon_expiry', label: 'クーポンの有効期限', group: 'クーポン' },
  { key: 'unsubscribe_url', label: '配信停止 URL' },
];
const DELIMITERS = { open: '{{', close: '}}' };

/** @param {any} list */
const optionKeys = (list) =>
  [...list.shadowRoot.querySelectorAll('[role="option"]')].map((o) => o.dataset.key);

/** @param {any} list */
const activeKey = (list) =>
  /** @type {HTMLElement | null} */ (list.shadowRoot.querySelector('[aria-selected="true"]'))
    ?.dataset.key;

describe('差し込み変数の絞り込み', () => {
  it('グループ名・表示名・キーで絞り込み、グループごとにまとめる（グループの無い候補は最後）', () => {
    const names = (/** @type {string} */ q) =>
      filterMergeTags(TAGS, q).map((g) => [g.name, g.tags.map((t) => t.key)]);
    expect(names('')).toEqual([
      ['会員', ['name', 'points']],
      ['クーポン', ['coupon', 'coupon_expiry']],
      [null, ['unsubscribe_url']],
    ]);
    expect(names('会員')).toEqual([['会員', ['name', 'points']]]);
    expect(names('期限')).toEqual([['クーポン', ['coupon_expiry']]]);
    expect(names('ＣＯＵＰＯＮ')).toEqual([['クーポン', ['coupon', 'coupon_expiry']]]);
    expect(names('クーポン expiry')).toEqual([['クーポン', ['coupon_expiry']]]);
    expect(names('zzz')).toEqual([]);
  });

  it('キャレットの直前の区切り開始文字と入力中の文字を見つける', () => {
    expect(findMergeTagTrigger('こんにちは {{', DELIMITERS)).toEqual({ start: 6, query: '' });
    expect(findMergeTagTrigger('a {{cou', DELIMITERS)).toEqual({ start: 2, query: 'cou' });
    expect(findMergeTagTrigger('a {{ na', DELIMITERS)).toEqual({ start: 2, query: 'na' });
    expect(findMergeTagTrigger('{{name}} 様', DELIMITERS)).toBeNull();
    expect(findMergeTagTrigger('a { b', DELIMITERS)).toBeNull();
    expect(findMergeTagTrigger(`{{${'x'.repeat(41)}`, DELIMITERS)).toBeNull();
    expect(findMergeTagTrigger('%%name', { open: '%%', close: '%%' })).toEqual({
      start: 0,
      query: 'name',
    });
    expect(findMergeTagTrigger('%%name%% hi', { open: '%%', close: '%%' })).toBeNull();
    expect(findMergeTagTrigger('x %%na', { open: '%%', close: '%%' })).toEqual({
      start: 2,
      query: 'na',
    });
  });
});

describe('差し込み変数のコンボボックス（設定パネル）', () => {
  /** @param {Record<string, unknown>} [props] */
  async function openButton(props = {}) {
    const el = await mount({ mergeTags: TAGS, ...props });
    const template = createTemplate();
    const block = createBlock('button', { label: 'ボタン' });
    template.body.rows.push(createRow('1', [[block]]));
    el.loadJson(template);
    el.select(block.id);
    await frame();
    const field = /** @type {HTMLElement} */ (deep(el, 'mm-settings-panel', '[data-key="label"]'));
    const input = /** @type {HTMLInputElement} */ (field.querySelector('input'));
    const label = () => el.getJson().body.rows[0].columns[0].blocks[0].values.label;
    return { el, field, input, label };
  }

  it('ボタンで開き、入力した文字で絞り込んで、上下キーと Enter で選ぶ', async () => {
    const { field, input, label } = await openButton();
    input.setSelectionRange(0, 0);
    const picker = /** @type {any} */ (field.querySelector('mm-merge-tag-picker'));
    picker.shadowRoot.querySelector('.toggle').click();
    await picker.updateComplete;
    const search = /** @type {HTMLInputElement} */ (picker.shadowRoot.querySelector('.search'));
    expect(picker.shadowRoot.activeElement).toBe(search);
    const list = picker.shadowRoot.querySelector('mm-merge-tag-list');
    await list.updateComplete;
    // グループの見出し
    expect(
      [...list.shadowRoot.querySelectorAll('.group')].map((g) => g.textContent.trim()),
    ).toEqual(['会員', 'クーポン', 'その他']);
    search.value = 'クーポン';
    search.dispatchEvent(new Event('input'));
    await picker.updateComplete;
    await list.updateComplete;
    expect(optionKeys(list)).toEqual(['coupon', 'coupon_expiry']);
    press(search, 'ArrowDown');
    await list.updateComplete;
    expect(activeKey(list)).toBe('coupon_expiry');
    press(search, 'Enter');
    await frame();
    expect(label()).toBe('{{coupon_expiry}}ボタン');
    expect(picker.open).toBe(false);
  });

  it('区切り開始文字を入力すると候補を出し、続けて入力した文字で絞り込む', async () => {
    const { el, field, input, label } = await openButton();
    const type = async (/** @type {string} */ value) => {
      input.focus();
      input.value = value;
      input.setSelectionRange(value.length, value.length);
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await frame();
    };
    await type('ボタン {{');
    const suggest = () =>
      /** @type {any} */ (field.querySelector('.mm-merge-tag-suggest mm-merge-tag-list'));
    expect(suggest()).not.toBeNull();
    await suggest().updateComplete;
    expect(optionKeys(suggest())).toHaveLength(5);
    await type('ボタン {{ポイ');
    await suggest().updateComplete;
    expect(optionKeys(suggest())).toEqual(['points']);
    press(input, 'Enter');
    await frame();
    expect(label()).toBe('ボタン {{points}}');
    expect(suggest()).toBeNull();

    // Esc は候補を閉じるだけ（選択は外さない）
    await type('ボタン {{points}} {{');
    expect(suggest()).not.toBeNull();
    press(input, 'Escape');
    await frame();
    expect(suggest()).toBeNull();
    expect(deep(el, 'mm-settings-panel', '[data-key="label"]')).not.toBeNull();
  });

  it('mergeTagTrigger を false にすると、入力しても候補を出さない（ボタンは使える）', async () => {
    const { field, input } = await openButton({ mergeTagTrigger: false });
    input.value = '{{';
    input.setSelectionRange(2, 2);
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await frame();
    expect(field.querySelector('.mm-merge-tag-suggest')).toBeNull();
    expect(field.querySelector('mm-merge-tag-picker')).not.toBeNull();
  });

  it('属性 merge-tag-trigger="false" でオフにできる', async () => {
    const el = await mount();
    expect(el.mergeTagTrigger).toBe(true);
    el.setAttribute('merge-tag-trigger', 'false');
    expect(el.mergeTagTrigger).toBe(false);
    el.setAttribute('merge-tag-trigger', '');
    expect(el.mergeTagTrigger).toBe(true);
  });
});

describe('日本語入力（IME）の変換中の Enter', () => {
  // 変換の確定の Enter: Chrome・Firefox は isComposing: true、Safari は compositionend の後に keyCode 229
  const IME_ENTERS = [
    { isComposing: true, keyCode: 229 },
    { isComposing: false, keyCode: 229 },
  ];

  it('ツールバーのコンボボックスでは、確定の Enter で候補を入れない', async () => {
    const el = await mount({ mergeTags: TAGS });
    el.loadJson(fixtures.basic);
    await frame();
    const block = /** @type {any} */ (canvasBlocks(el)[1]);
    block.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await frame();
    await frame();
    const editor = block.shadowRoot.querySelector('mm-text-editor');
    await editor.updateComplete;
    const before = el.getJson().body.rows[1].columns[0].blocks[0].values.html;
    const picker = editor.shadowRoot.querySelector('mm-merge-tag-picker');
    picker.shadowRoot.querySelector('.toggle').click();
    await picker.updateComplete;
    const search = picker.shadowRoot.querySelector('.search');
    // 変換中の文字（候補に一致する）で絞り込まれた状態
    search.value = 'クーポン';
    search.dispatchEvent(new Event('input'));
    await picker.updateComplete;
    await picker.shadowRoot.querySelector('mm-merge-tag-list').updateComplete;
    for (const init of IME_ENTERS) press(search, 'Enter', init);
    await frame();
    expect(el.getJson().body.rows[1].columns[0].blocks[0].values.html).toBe(before);
    expect(picker.open).toBe(true);
    // 変換を確定した後の Enter で選ぶ
    press(search, 'Enter');
    await frame();
    expect(el.getJson().body.rows[1].columns[0].blocks[0].values.html).toContain('{{coupon}}');
  });

  it('設定欄の入力中の候補とコンボボックスでも、確定の Enter で候補を入れない', async () => {
    const el = await mount({ mergeTags: TAGS });
    const template = createTemplate();
    const block = createBlock('button', { label: 'ボタン' });
    template.body.rows.push(createRow('1', [[block]]));
    el.loadJson(template);
    el.select(block.id);
    await frame();
    const field = /** @type {HTMLElement} */ (deep(el, 'mm-settings-panel', '[data-key="label"]'));
    const input = /** @type {HTMLInputElement} */ (field.querySelector('input'));
    const label = () => el.getJson().body.rows[0].columns[0].blocks[0].values.label;
    input.focus();
    input.value = 'ボタン {{クー';
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await frame();
    expect(field.querySelector('.mm-merge-tag-suggest')).not.toBeNull();
    for (const init of IME_ENTERS) press(input, 'Enter', init);
    await frame();
    expect(label()).toBe('ボタン {{クー');
    expect(field.querySelector('.mm-merge-tag-suggest')).not.toBeNull();

    const picker = /** @type {any} */ (field.querySelector('mm-merge-tag-picker'));
    picker.shadowRoot.querySelector('.toggle').click();
    await picker.updateComplete;
    const search = picker.shadowRoot.querySelector('.search');
    for (const init of IME_ENTERS) press(search, 'Enter', init);
    await frame();
    expect(label()).toBe('ボタン {{クー');
  });

  it('キャンバスの入力中の候補でも、確定の Enter で候補を入れず、改行もしない', async () => {
    const el = await mount({ mergeTags: TAGS });
    el.loadJson(fixtures.basic);
    await frame();
    const block = /** @type {any} */ (canvasBlocks(el)[1]);
    block.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await frame();
    await frame();
    const editor = block.shadowRoot.querySelector('mm-text-editor');
    await editor.updateComplete;
    const editable = /** @type {HTMLElement} */ (editor.shadowRoot.querySelector('.editable'));
    editable.focus();
    const last = /** @type {Text} */ (editable.querySelector('p')?.lastChild);
    /** @type {Selection} */ (document.getSelection()).setBaseAndExtent(
      last,
      last.length,
      last,
      last.length,
    );
    document.execCommand('insertText', false, '{{クー');
    await frame();
    const html = () => el.getJson().body.rows[1].columns[0].blocks[0].values.html;
    const before = html();
    for (const init of IME_ENTERS) press(editable, 'Enter', init);
    await frame();
    expect(html()).toBe(before);
    expect(editor.shadowRoot.querySelector('.suggest')).not.toBeNull();
    // 変換中の Esc は編集を終えない
    press(editable, 'Escape', { isComposing: true, keyCode: 229 });
    await frame();
    expect(canvasBlocks(el)[1].hasAttribute('editing')).toBe(true);
  });
});

describe('差し込み変数の候補（キャンバス）', () => {
  /**
   * テキストブロックを直接編集し、キャレットを末尾に置く
   * @param {Record<string, unknown>} [props]
   */
  async function startEditing(props = {}) {
    const el = await mount({ mergeTags: TAGS, ...props });
    el.loadJson(fixtures.basic);
    await frame();
    const block = /** @type {any} */ (canvasBlocks(el)[1]);
    block.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await frame();
    await frame();
    const editor = block.shadowRoot.querySelector('mm-text-editor');
    await editor.updateComplete;
    const editable = /** @type {HTMLElement} */ (editor.shadowRoot.querySelector('.editable'));
    editable.focus();
    const last = /** @type {Text} */ (editable.querySelector('p')?.lastChild);
    /** @type {Selection} */ (document.getSelection()).setBaseAndExtent(
      last,
      last.length,
      last,
      last.length,
    );
    const html = () => el.getJson().body.rows[1].columns[0].blocks[0].values.html;
    const suggest = () => editor.shadowRoot.querySelector('.suggest mm-merge-tag-list');
    return { el, editor, editable, html, suggest };
  }

  it('区切り開始文字を入力すると候補を出し、選ぶと入力中の文字ごと置き換える', async () => {
    const { editable, html, suggest } = await startEditing();
    document.execCommand('insertText', false, '{{');
    await frame();
    expect(suggest()).not.toBeNull();
    document.execCommand('insertText', false, 'cou');
    await frame();
    await suggest().updateComplete;
    expect(optionKeys(suggest())).toEqual(['coupon', 'coupon_expiry']);
    press(editable, 'ArrowDown');
    await suggest().updateComplete;
    press(editable, 'Enter');
    await frame();
    expect(html()).toContain('入荷しました。{{coupon_expiry}}</p>');
    expect(html()).not.toContain('{{cou{{');
    expect(suggest()).toBeNull();
  });

  it('候補はクリックでも選べる。Esc は候補を閉じるだけで編集を続ける', async () => {
    const { el, editable, html, suggest } = await startEditing();
    document.execCommand('insertText', false, '{{');
    await frame();
    await suggest().updateComplete;
    suggest().shadowRoot.querySelector('[data-key="name"]').click();
    await frame();
    expect(html()).toContain('入荷しました。{{name}}</p>');

    document.execCommand('insertText', false, ' {{');
    await frame();
    press(editable, 'Escape');
    await frame();
    expect(suggest()).toBeNull();
    expect(canvasBlocks(el)[1].hasAttribute('editing')).toBe(true);
  });

  it('mergeTagTrigger を false にすると候補を出さない', async () => {
    const { suggest } = await startEditing({ mergeTagTrigger: false });
    document.execCommand('insertText', false, '{{');
    await frame();
    expect(suggest()).toBeNull();
  });

  it('書式ツールバーのコンボボックスで絞り込んで入れる', async () => {
    const { editor, html } = await startEditing();
    const picker = editor.shadowRoot.querySelector('mm-merge-tag-picker');
    picker.shadowRoot.querySelector('.toggle').click();
    await picker.updateComplete;
    const search = picker.shadowRoot.querySelector('.search');
    search.value = 'unsub';
    search.dispatchEvent(new Event('input'));
    await picker.updateComplete;
    await picker.shadowRoot.querySelector('mm-merge-tag-list').updateComplete;
    press(search, 'Enter');
    await frame();
    expect(html()).toContain('入荷しました。{{unsubscribe_url}}</p>');
  });

  it('表のセルでも使え、候補を出している間の Tab は候補を選ぶ（セルを移らない）', async () => {
    const el = await mount({ mergeTags: TAGS });
    el.loadJson(fixtures.contentBlocks);
    await frame();
    const block = /** @type {any} */ (canvasBlocks(el)[3]);
    const cell = block.shadowRoot.querySelector('table.mm-table').rows[1].cells[0];
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await frame();
    await frame();
    const tableEditor = block.shadowRoot.querySelector('mm-table-editor');
    await tableEditor.updateComplete;
    const editor = tableEditor.shadowRoot.querySelector('mm-text-editor');
    await editor.updateComplete;
    const editable = editor.shadowRoot.querySelector('.editable');
    editable.focus();
    const text = /** @type {Text} */ (editable.lastChild);
    /** @type {Selection} */ (document.getSelection()).setBaseAndExtent(
      text,
      text.length,
      text,
      text.length,
    );
    document.execCommand('insertText', false, '{{na');
    await frame();
    const list = editor.shadowRoot.querySelector('.suggest mm-merge-tag-list');
    expect(list).not.toBeNull();
    press(editable, 'Tab');
    await frame();
    const values = /** @type {any} */ (el.getJson().body.rows[3].columns[0].blocks[0].values);
    expect(values.cells[1][0]).toBe('S{{name}}');
    expect(
      tableEditor.shadowRoot.querySelector('mm-text-editor').closest('td').dataset.column,
    ).toBe('0');
  });
});
