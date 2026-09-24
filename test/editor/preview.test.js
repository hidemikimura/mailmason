import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasBlocks, deep, fixtures, frame, mount, once, press } from './helpers.js';
import { PREVIEW_DEBOUNCE_MS } from '../../src/editor/components/mm-preview.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

const MERGE_TAGS = [
  { key: 'name', label: '氏名', sample: '山田 太郎' },
  { key: 'unsubscribe_url', label: '配信停止 URL', fallback: 'https://example.com/u' },
];

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {MailmasonEditor} el
 * @param {string} group
 * @param {string} value
 */
async function clickToolbar(el, group, value) {
  const button = /** @type {HTMLButtonElement} */ (
    deep(el, 'mm-toolbar', `[data-group="${group}"] [data-value="${value}"]`)
  );
  button.click();
  await frame();
}

/** @param {MailmasonEditor} el */
const preview = (el) => /** @type {any} */ (deep(el, 'mm-preview'));

/** @param {MailmasonEditor} el */
const iframe = (el) => /** @type {HTMLIFrameElement} */ (deep(el, 'mm-preview', 'iframe'));

/**
 * @param {MailmasonEditor} el
 * @param {string} selector
 */
const inPreview = (el, selector) => /** @type {any} */ (deep(el, 'mm-preview', selector));

/** @param {HTMLIFrameElement} frameEl */
async function loaded(frameEl) {
  await vi.waitFor(() => {
    expect(frameEl.contentDocument?.body?.children.length).toBeGreaterThan(0);
  });
  await frame();
}

async function setup(props = {}) {
  const el = await mount({ mergeTags: MERGE_TAGS, ...props });
  el.loadJson(fixtures.basic);
  await frame();
  return el;
}

/**
 * プレビューを開き、テキストタブに切り替える
 * @param {MailmasonEditor} el
 */
async function openTextTab(el) {
  await clickToolbar(el, 'view', 'preview');
  inPreview(el, '[data-tab="text"]').click();
  await frame();
}

describe('プレビュー', () => {
  it('ツールバーで編集 ⇄ プレビューを切り替え、mm-view を発火する', async () => {
    const el = await setup();
    expect(preview(el).hidden).toBe(true);
    const event = once(el, 'mm-view');
    await clickToolbar(el, 'view', 'preview');
    expect((await event).detail).toEqual({ view: 'preview', device: 'desktop' });
    expect(el.view).toBe('preview');
    expect(el.getAttribute('view')).toBe('preview');
    expect(preview(el).hidden).toBe(false);
    const main = /** @type {HTMLElement} */ (deep(el, '.main'));
    expect(main.hidden).toBe(true);

    await clickToolbar(el, 'view', 'edit');
    expect(el.view).toBe('edit');
    expect(preview(el).hidden).toBe(true);
  });

  it('編集中は出力を作らない（表示したときに作る）', async () => {
    const el = await setup();
    expect(preview(el)._output).toBeNull();
    el.store.dispatch({
      type: 'updateBlockValues',
      blockId: 'b_button01',
      patch: { label: '変更後' },
    });
    await frame();
    expect(preview(el)._output).toBeNull();
    el.view = 'preview';
    await frame();
    expect(iframe(el).srcdoc).toContain('変更後');
  });

  it('配信用 HTML をスクリプト不可の iframe に出し、サンプル値 → 既定値の順で差し込む', async () => {
    const el = await setup();
    await clickToolbar(el, 'view', 'preview');
    const frameEl = iframe(el);
    expect(frameEl.getAttribute('sandbox')).not.toContain('allow-scripts');
    expect(frameEl.getAttribute('sandbox')).toContain('allow-same-origin');
    expect(frameEl.srcdoc).toContain('<base target="_blank" />');
    expect(frameEl.srcdoc).toContain('山田 太郎 様');
    expect(frameEl.srcdoc).toContain('https://example.com/u'); // sample の無い候補は fallback
    expect(frameEl.srcdoc).not.toContain('{{name}}');

    // チェックを外すとマージタグのまま
    const check = inPreview(el, '[data-action="samples"]');
    check.checked = false;
    check.dispatchEvent(new Event('change'));
    await frame();
    await preview(el).updateComplete;
    expect(iframe(el).srcdoc).toContain('{{name}}');
  });

  it('iframe の高さを中身に合わせる', async () => {
    const el = await setup();
    await clickToolbar(el, 'view', 'preview');
    const frameEl = iframe(el);
    await loaded(frameEl);
    await vi.waitFor(() => {
      const content = /** @type {Document} */ (frameEl.contentDocument).documentElement
        .scrollHeight;
      expect(frameEl.getBoundingClientRect().height).toBe(content);
    });
  });

  it('PC は 900px、スマホは 375px の幅で表示する', async () => {
    const el = await setup();
    await clickToolbar(el, 'view', 'preview');
    expect(iframe(el).clientWidth).toBe(900);
    const event = once(el, 'mm-view');
    await clickToolbar(el, 'device', 'mobile');
    expect((await event).detail).toEqual({ view: 'preview', device: 'mobile' });
    expect(el.getAttribute('preview-device')).toBe('mobile');
    const frameEl = iframe(el);
    expect(frameEl.clientWidth).toBe(375);
    // スマホ幅ではメディアクエリが効き、カラムが縦に並ぶ
    await loaded(frameEl);
    const col = /** @type {HTMLElement} */ (frameEl.contentDocument?.querySelector('.mm-col'));
    expect(frameEl.contentWindow?.getComputedStyle(col).display).toBe('block');
  });

  it('プレビュー中の本文の変更は、最後の変更から少し待ってから反映する', async () => {
    const el = await setup();
    await clickToolbar(el, 'view', 'preview');
    const change = (/** @type {string} */ label) =>
      el.store.dispatch({ type: 'updateBlockValues', blockId: 'b_button01', patch: { label } });
    change('一回目');
    await frame();
    expect(iframe(el).srcdoc).not.toContain('一回目');
    await sleep(PREVIEW_DEBOUNCE_MS / 2);
    change('二回目');
    await frame();
    await sleep(PREVIEW_DEBOUNCE_MS / 2 + 20);
    expect(iframe(el).srcdoc).not.toContain('二回目'); // 待ち時間は最後の変更から数える
    await sleep(PREVIEW_DEBOUNCE_MS / 2 + 100);
    await frame();
    expect(iframe(el).srcdoc).toContain('二回目');
  });

  it('HTML の大きさを表示する', async () => {
    const el = await setup();
    await clickToolbar(el, 'view', 'preview');
    expect(inPreview(el, '[data-size]').textContent).toMatch(/HTML \d+\.\dKB/);
  });

  it('テキストタブは自動生成のテキストを表示する', async () => {
    const el = await setup();
    await openTextTab(el);
    const pre = inPreview(el, 'pre');
    expect(pre.textContent).toContain('山田 太郎 様');
    expect(pre.textContent).toContain('▶ 新作を見る');
    expect(inPreview(el, 'textarea')).toBeNull();
  });

  it('「編集する」で手編集に切り替え、入力はテキストパートに保存する', async () => {
    const el = await setup();
    await openTextTab(el);
    inPreview(el, '[data-action="edit-text"]').click();
    await frame();
    const { text } = el.getJson();
    expect(text.mode).toBe('manual');
    expect(text.content).toContain('{{name}} 様'); // 保存するのは差し込み前
    expect(text.sourceHash).toMatch(/^[0-9a-f]{8}$/);

    const textarea = /** @type {HTMLTextAreaElement} */ (inPreview(el, 'textarea'));
    expect(textarea.value).toBe(text.content);
    textarea.value = 'テキスト版です';
    textarea.dispatchEvent(new Event('input'));
    textarea.value = 'テキスト版です。';
    textarea.dispatchEvent(new Event('input'));
    await frame();
    expect(el.getJson().text.content).toBe('テキスト版です。');
    expect(el.exportText()).toBe('テキスト版です。');
    expect(el.getJson().text.sourceHash).toBe(text.sourceHash);

    // 連続入力は 1 回の Undo で戻る
    el.undo();
    await frame();
    expect(el.getJson().text.content).toBe(text.content);

    inPreview(el, '[data-action="reset-text"]').click();
    await frame();
    expect(el.getJson().text).toEqual({ mode: 'auto', content: null, sourceHash: null });
    expect(inPreview(el, 'pre')).not.toBeNull();
  });

  it('手編集の後に本文が変わったら警告を出し、確認済みにすると消える', async () => {
    const el = await setup();
    const warnings = /** @type {any[]} */ ([]);
    el.addEventListener('mm-warning', (e) => warnings.push(/** @type {CustomEvent} */ (e).detail));
    await openTextTab(el);
    inPreview(el, '[data-action="edit-text"]').click();
    await frame();
    expect(inPreview(el, '.notice')).toBeNull();

    await clickToolbar(el, 'view', 'edit');
    el.store.dispatch({
      type: 'updateBlockValues',
      blockId: 'b_button01',
      patch: { label: 'セール会場へ' },
    });
    await clickToolbar(el, 'view', 'preview');
    await frame();
    expect(inPreview(el, '.notice')).not.toBeNull();
    expect(warnings.filter((w) => w.code === 'stale-text')).toHaveLength(1);

    // 同じ状態では何度も通知しない
    const textarea = /** @type {HTMLTextAreaElement} */ (inPreview(el, 'textarea'));
    textarea.value = `${textarea.value}\n追記`;
    textarea.dispatchEvent(new Event('input'));
    await frame();
    expect(warnings.filter((w) => w.code === 'stale-text')).toHaveLength(1);

    inPreview(el, '[data-action="acknowledge"]').click();
    await frame();
    expect(inPreview(el, '.notice')).toBeNull();
    expect(el.getJson().text.content).toContain('追記');
  });

  it('プレビュー中は Undo / Redo 以外のショートカットを受け付けない', async () => {
    const el = await setup();
    el.select('b_button01');
    await frame();
    await clickToolbar(el, 'view', 'preview');
    press(el, 'Delete');
    await frame();
    expect(el.getJson().body.rows[1].columns[0].blocks).toHaveLength(2);

    el.store.dispatch({ type: 'removeBlock', blockId: 'b_button01' });
    press(el, 'z', { ctrlKey: true });
    await frame();
    expect(el.getJson().body.rows[1].columns[0].blocks).toHaveLength(2);
  });

  it('プレビューに切り替えると直接編集を終える', async () => {
    const el = await setup();
    const block = canvasBlocks(el)[1];
    block.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await frame();
    expect(block.hasAttribute('editing')).toBe(true);
    await clickToolbar(el, 'view', 'preview');
    await clickToolbar(el, 'view', 'edit');
    expect(canvasBlocks(el)[1].hasAttribute('editing')).toBe(false);
  });

  it('エクスポートで差し込むときは、値の無いキーに候補の既定値（fallback）を使う', async () => {
    const el = await setup();
    const html = el.exportHtml({ mergeValues: { name: '佐藤' } });
    expect(html).toContain('佐藤 様');
    expect(html).toContain('https://example.com/u');
    expect(el.exportText({ mergeValues: { name: '佐藤' } })).toContain('https://example.com/u');
    // 値を渡さなければ置換しない
    expect(el.exportHtml()).toContain('{{unsubscribe_url}}');
  });
});
