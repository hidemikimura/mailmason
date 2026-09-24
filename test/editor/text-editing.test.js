import { afterEach, describe, expect, it } from 'vitest';
import { canvasBlocks, fixtures, frame, mount, press } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

/** @param {MailmasonEditor} el */
const textHtml = (el) => el.getJson().body.rows[1].columns[0].blocks[0].values.html;

/**
 * 見出し＋本文のテキストブロック（b_text0001）を直接編集の状態にする
 * @param {Record<string, unknown>} [props]
 */
async function startEditing(props = {}) {
  const el = await mount(props);
  el.loadJson(fixtures.basic);
  await frame();
  const block = canvasBlocks(el)[1];
  block.click(); // 選択
  await frame();
  block.click(); // もう一度クリックで編集
  await frame();
  await frame();
  const editor = /** @type {any} */ (block.shadowRoot.querySelector('mm-text-editor'));
  await editor.updateComplete;
  const editable = /** @type {HTMLElement} */ (editor.shadowRoot.querySelector('.editable'));
  return { el, block, editor, editable };
}

/**
 * 編集領域の中身を全部選択する
 * @param {HTMLElement} editable
 */
function selectAll(editable) {
  // addRange は Shadow DOM 内の範囲を WebKit で無視されるため、setBaseAndExtent を使う
  const selection = /** @type {Selection} */ (document.getSelection());
  selection.setBaseAndExtent(editable, 0, editable, editable.childNodes.length);
}

/**
 * 見出し（最初の要素）の文字だけを選択する
 * @param {HTMLElement} editable
 */
function selectHeading(editable) {
  const text = /** @type {Text} */ (editable.querySelector('h1')?.firstChild);
  /** @type {Selection} */ (document.getSelection()).setBaseAndExtent(text, 0, text, text.length);
}

/**
 * 貼り付けイベントを送る
 * @param {HTMLElement} target
 * @param {Record<string, string>} data
 */
function paste(target, data) {
  const clipboardData = new DataTransfer();
  for (const [type, value] of Object.entries(data)) clipboardData.setData(type, value);
  const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, composed: true });
  // コンストラクタの clipboardData は Firefox では中身が引き継がれないため、プロパティで差し込む
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  target.dispatchEvent(event);
}

describe('テキストの直接編集', () => {
  it('選択中のテキストをもう一度クリックすると編集状態になり、書式ツールバーが出る', async () => {
    const { block, editor, editable } = await startEditing();
    expect(block.hasAttribute('editing')).toBe(true);
    expect(editor.shadowRoot.querySelector('[role="toolbar"]')).not.toBeNull();
    expect(editable.isContentEditable).toBe(true);
    expect(editable.innerHTML).toBe(fixtures.basic.body.rows[1].columns[0].blocks[0].values.html);
  });

  it('ダブルクリックや Enter でも編集を始められる', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    await frame();
    canvasBlocks(el)[1].dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, composed: true }),
    );
    await frame();
    expect(canvasBlocks(el)[1].hasAttribute('editing')).toBe(true);

    press(el, 'Escape');
    el.select('b_text0002');
    await frame();
    press(el, 'Enter');
    await frame();
    expect(canvasBlocks(el)[8].hasAttribute('editing')).toBe(true);
  });

  it('入力すると許可タグに整えてストアへ反映し、連続入力は 1 つの履歴にまとまる', async () => {
    const { el, editable } = await startEditing();
    editable.focus();
    document.execCommand('insertText', false, 'A');
    document.execCommand('insertText', false, 'B');
    await frame();
    expect(textHtml(el)).toBe(
      '<h1>{{name}} 様</h1><p>いつもご利用ありがとうございます。<br>秋の新作が入荷しました。AB</p>',
    );
    el.undo();
    await frame();
    expect(textHtml(el)).toBe(fixtures.basic.body.rows[1].columns[0].blocks[0].values.html);
    // 外部からの変更（Undo）は編集領域にも反映される
    expect(editable.innerHTML).toBe(fixtures.basic.body.rows[1].columns[0].blocks[0].values.html);
  });

  it('ツールバーのボタンで選択範囲に書式を付ける（b は strong に整える）', async () => {
    const { el, editor, editable } = await startEditing();
    selectAll(editable);
    editor.shadowRoot.querySelector('[data-command="italic"]').click();
    await frame();
    expect(textHtml(el)).toContain('<em>');
    expect(textHtml(el)).not.toContain('<i>');
  });

  it('文字色は span の color にする', async () => {
    const { el, editor, editable } = await startEditing();
    selectAll(editable);
    editor.shadowRoot.querySelector('[data-command="color"]').click();
    await editor.updateComplete;
    editor.shadowRoot.querySelectorAll('.swatch')[2].click();
    await frame();
    expect(textHtml(el)).toContain('<span style="color:#cc0000">');
  });

  it('リンクを付けられる', async () => {
    const { el, editor, editable } = await startEditing();
    selectAll(editable);
    editor.shadowRoot.querySelector('[data-command="link"]').click();
    await editor.updateComplete;
    const input = editor.shadowRoot.querySelector('.link-input');
    input.value = 'https://example.com/sale';
    editor.shadowRoot.querySelector('form.popover').requestSubmit();
    await frame();
    expect(textHtml(el)).toContain('<a href="https://example.com/sale">');
  });

  it('リンクの中で開き直すと、設定済みの URL が入力欄に入っている', async () => {
    const { el, editor, editable } = await startEditing();
    const openLink = async () => {
      editor.shadowRoot.querySelector('[data-command="link"]').click();
      await editor.updateComplete;
      await frame();
      return /** @type {HTMLInputElement} */ (editor.shadowRoot.querySelector('.link-input'));
    };
    const submit = async () => {
      editor.shadowRoot.querySelector('form.popover').requestSubmit();
      await frame();
    };

    // リンクの無いところでは空（見出しの文字だけを選ぶ）
    selectHeading(editable);
    let input = await openLink();
    expect(input.value).toBe('');
    input.value = 'https://example.com/old';
    await submit();

    // キャレットをリンクの文字の途中に置いて開き直す
    const text = /** @type {Text} */ (editable.querySelector('a')?.firstChild);
    document.getSelection()?.setBaseAndExtent(text, 1, text, 1);
    await frame();
    input = await openLink();
    expect(input.value).toBe('https://example.com/old');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);

    // キャレットだけでも、リンク全体の URL を差し替える（URL の文字を挿入しない）
    // （リンクの一部だけを選んだときも同じくリンク全体が対象）
    input.value = 'https://example.com/new';
    await submit();
    expect(textHtml(el)).toContain('<h1><a href="https://example.com/new">{{name}} 様</a></h1>');
    expect(textHtml(el)).not.toContain('example.com/old');
    expect(editable.textContent).not.toContain('https://');
  });

  it('リンクの一部だけを選んで URL を変えても、リンクは分かれない', async () => {
    const { el, editor, editable } = await startEditing();
    selectHeading(editable);
    editor.shadowRoot.querySelector('[data-command="link"]').click();
    await editor.updateComplete;
    editor.shadowRoot.querySelector('.link-input').value = 'https://example.com/a';
    editor.shadowRoot.querySelector('form.popover').requestSubmit();
    await frame();

    const text = /** @type {Text} */ (editable.querySelector('a')?.firstChild);
    document.getSelection()?.setBaseAndExtent(text, 2, text, 5);
    await frame();
    editor.shadowRoot.querySelector('[data-command="link"]').click();
    await editor.updateComplete;
    await frame();
    const input = editor.shadowRoot.querySelector('.link-input');
    expect(input.value).toBe('https://example.com/a');
    input.value = 'https://example.com/b';
    editor.shadowRoot.querySelector('form.popover').requestSubmit();
    await frame();
    expect(textHtml(el)).toContain('<h1><a href="https://example.com/b">{{name}} 様</a></h1>');
  });

  it('リンクの中で URL を空にして適用するとリンクを外す', async () => {
    const { el, editor, editable } = await startEditing();
    selectHeading(editable);
    editor.shadowRoot.querySelector('[data-command="link"]').click();
    await editor.updateComplete;
    editor.shadowRoot.querySelector('.link-input').value = 'https://example.com/x';
    editor.shadowRoot.querySelector('form.popover').requestSubmit();
    await frame();
    expect(textHtml(el)).toContain('<a ');

    const text = /** @type {Text} */ (editable.querySelector('a')?.firstChild);
    document.getSelection()?.setBaseAndExtent(text, 1, text, 1);
    await frame();
    editor.shadowRoot.querySelector('[data-command="link"]').click();
    await editor.updateComplete;
    await frame();
    const input = editor.shadowRoot.querySelector('.link-input');
    expect(input.value).toBe('https://example.com/x');
    input.value = '';
    editor.shadowRoot.querySelector('form.popover').requestSubmit();
    await frame();
    expect(textHtml(el)).not.toContain('<a ');
  });

  it('HTML を貼り付けると許可タグだけに整えて入れる', async () => {
    const { el, editable } = await startEditing();
    editable.focus();
    paste(editable, {
      'text/html': '<b>太字</b><script>alert(1)</script><span style="font-size:30px">大</span>',
      'text/plain': '太字大',
    });
    await frame();
    expect(textHtml(el)).toContain('<strong>太字</strong>大');
    expect(textHtml(el)).not.toContain('script');
    expect(textHtml(el)).not.toContain('font-size');
  });

  it('プレーンテキストの貼り付けは空行で段落、改行で <br> にする', async () => {
    const { el, editable } = await startEditing();
    selectAll(editable);
    paste(editable, { 'text/plain': '一行目\n二行目\n\n次の段落' });
    await frame();
    expect(textHtml(el)).toBe('<p>一行目<br>二行目</p><p>次の段落</p>');
  });

  it('編集中の Ctrl+Z はストアの Undo になる', async () => {
    const { el, editable } = await startEditing();
    editable.focus();
    document.execCommand('insertText', false, 'X');
    await frame();
    editable.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, composed: true }),
    );
    await frame();
    expect(textHtml(el)).toBe(fixtures.basic.body.rows[1].columns[0].blocks[0].values.html);
  });

  it('編集中の Delete キーでブロックを消さない', async () => {
    const { el, editable } = await startEditing();
    editable.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true }),
    );
    await frame();
    expect(el.getJson().body.rows[1].columns[0].blocks).toHaveLength(2);
  });

  it('Esc で編集を終える（選択は残る）', async () => {
    const { el, block, editable } = await startEditing();
    editable.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    );
    await frame();
    expect(block.hasAttribute('editing')).toBe(false);
    expect(el.store.getState().selection).toBe('b_text0001');
  });

  it('別の要素を選ぶと編集を終える', async () => {
    const { el, block } = await startEditing();
    el.select('b_button01');
    await frame();
    expect(block.hasAttribute('editing')).toBe(false);
  });

  it('差し込みメニューでマージタグを入れる', async () => {
    const { el, editor, editable } = await startEditing({
      mergeTags: [{ key: 'coupon', label: 'クーポン' }],
    });
    editable.focus();
    const menu = /** @type {HTMLSelectElement} */ (
      [...editor.shadowRoot.querySelectorAll('select')].pop()
    );
    menu.value = 'coupon';
    menu.dispatchEvent(new Event('change'));
    await frame();
    expect(textHtml(el)).toContain('{{coupon}}');
  });

  it('マージタグをハイライトする（CSS Custom Highlight API がある場合）', async () => {
    await startEditing();
    if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
      expect(CSS.highlights.has('mm-merge-tag')).toBe(true);
    }
  });

  it('画像＋テキストのテキストも直接編集できる', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    await frame();
    const block = canvasBlocks(el)[3];
    block.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await frame();
    await frame();
    const editor = /** @type {any} */ (block.shadowRoot.querySelector('mm-text-editor'));
    await editor.updateComplete;
    const editable = /** @type {HTMLElement} */ (editor.shadowRoot.querySelector('.editable'));
    editable.focus();
    document.execCommand('insertText', false, '（新作）');
    await frame();
    expect(el.getJson().body.rows[2].columns[0].blocks[0].values.html).toBe(
      '<p><strong>ニットカーディガン</strong><br>¥8,900（新作）</p>',
    );
    expect(block.shadowRoot.querySelector('.image-text img')).not.toBeNull();
  });
});
