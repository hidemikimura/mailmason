import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailmasonError, createTemplate, renderHtml } from '../../src/index.js';
import {
  canvasBlocks,
  deep,
  deepAll,
  fixtures,
  frame,
  mount,
  once,
  press,
  typeInto,
} from './helpers.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('<mailmason-editor> 基本', () => {
  it('ツールバー・パレット・キャンバス・設定パネルを描画する', async () => {
    const el = await mount();
    for (const part of ['toolbar', 'palette', 'canvas', 'settings']) {
      expect(el.shadowRoot?.querySelector(`[part="${part}"]`)).not.toBeNull();
    }
  });

  it('初期化完了時に mm-ready を発火する', async () => {
    const el = document.createElement('mailmason-editor');
    const ready = once(el, 'mm-ready');
    document.body.append(el);
    await expect(ready).resolves.toBeInstanceOf(CustomEvent);
  });

  it('何も読み込んでいなければ theme を新規テンプレートに反映する', async () => {
    const el = await mount({ theme: { width: 640, linkColor: '#ff0000' } });
    expect(el.getJson().body.settings.width).toBe(640);
    expect(el.getJson().body.settings.linkColor).toBe('#ff0000');
  });

  it('空のテンプレートではキャンバスに案内を出す', async () => {
    const el = await mount();
    expect(deep(el, 'mm-canvas', '.empty')?.textContent).toContain('パレット');
  });
});

describe('読み込みと取り出し', () => {
  it('loadJson したテンプレートを描画し、getJson で取り出せる（コピー）', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    await frame();
    expect(deepAll(el, ['mm-canvas'], 'mm-row')).toHaveLength(4);
    expect(canvasBlocks(el)).toHaveLength(9);
    const json = el.getJson();
    expect(json).toEqual(fixtures.basic);
    json.body.rows = [];
    expect(el.getJson().body.rows).toHaveLength(4);
  });

  it('読み込み時に直した箇所を返し、mm-warning でも通知する', async () => {
    const el = await mount();
    const listener = vi.fn();
    el.addEventListener('mm-warning', listener);
    const warnings = el.loadJson({ body: { rows: [] } });
    expect(warnings.map((w) => w.code)).toEqual(['missing-version']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('テンプレートとして解釈できないときは例外', async () => {
    const el = await mount();
    expect(() => el.loadJson('{broken')).toThrow(MailmasonError);
  });

  it('読み込んだ JSON には theme を適用しない', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.theme = { width: 700 };
    await el.updateComplete;
    expect(el.getJson().body.settings.width).toBe(600);
  });

  it('template プロパティでも読み書きできる', async () => {
    const el = await mount();
    el.template = createTemplate({ width: 500 });
    expect(el.template.body.settings.width).toBe(500);
  });
});

describe('選択と設定パネル', () => {
  it('ブロックをクリックすると選択され、パンくずと項目が出る', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    await frame();
    const selected = once(el, 'mm-select');
    canvasBlocks(el)[2].click(); // ボタン
    expect((await selected).detail).toEqual({
      id: 'b_button01',
      kind: 'block',
      ids: ['b_button01'],
    });
    await frame();
    const crumbs = deepAll(el, ['mm-settings-panel'], 'nav button').map((b) =>
      b.textContent?.trim(),
    );
    expect(crumbs).toEqual(['全体', '行', 'カラム 1', 'ボタン']);
    expect(deep(el, 'mm-settings-panel', '[data-key="label"] input')).not.toBeNull();
    expect(canvasBlocks(el)[2].hasAttribute('selected')).toBe(true);
  });

  it('項目を編集するとキャンバスに反映され、mm-change は 1 フレームに 1 回にまとまる', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.select('b_button01');
    await frame();
    const listener = vi.fn();
    el.addEventListener('mm-change', listener);
    const input = /** @type {HTMLInputElement} */ (
      deep(el, 'mm-settings-panel', '[data-key="label"] input')
    );
    input.value = '今';
    input.dispatchEvent(new Event('input'));
    input.value = '今すぐ';
    input.dispatchEvent(new Event('input'));
    await frame();
    await frame();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail.actions).toEqual([
      'updateBlockValues',
      'updateBlockValues',
    ]);
    expect(canvasBlocks(el)[2].shadowRoot.textContent).toContain('今すぐ');
    // 連続入力は 1 つの履歴にまとまる
    el.undo();
    await frame();
    expect(el.getJson().body.rows[1].columns[0].blocks[1].values.label).toBe('新作を見る');
  });

  it('パンくずで親の要素を選べる', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.select('b_button01');
    await frame();
    const [, rowCrumb] = deepAll(el, ['mm-settings-panel'], 'nav button');
    rowCrumb.click();
    await frame();
    expect(deep(el, 'mm-settings-panel', '[data-key="layout"]')).not.toBeNull();
  });

  it('行のカラム分割を変えられる', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.select('r_body0001');
    await frame();
    const buttons = deepAll(el, ['mm-settings-panel'], '[data-key="layout"] button');
    buttons[1].click(); // 2 カラム
    await frame();
    expect(el.getJson().body.rows[1].layout).toBe('1:1');
    expect(el.getJson().body.rows[1].columns).toHaveLength(2);
  });

  it('何も選択していなければメール全体の設定を編集できる', async () => {
    const el = await mount();
    const width = /** @type {HTMLInputElement} */ (
      deep(el, 'mm-settings-panel', '[data-key="width"] input')
    );
    typeInto(width, '640');
    await frame();
    expect(el.getJson().body.settings.width).toBe(640);
    expect(deep(el, 'mm-canvas', '.mail')?.style.width).toBe('640px');
  });

  it('キャンバスの余白をクリックすると選択を解除する', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.select('b_button01');
    await frame();
    deep(el, 'mm-canvas', '.surface')?.click();
    await frame();
    expect(el.store.getState().selection).toBeNull();
  });

  it('画像の「選択…」で onImageSelect を呼び、返った URL を設定する', async () => {
    const onImageSelect = vi.fn(async () => ({
      src: 'https://example.com/new.png',
      alt: '新しい画像',
    }));
    const el = await mount({ onImageSelect });
    el.loadJson(fixtures.basic);
    el.select('b_banner01');
    await frame();
    const choose = /** @type {HTMLButtonElement} */ (
      deep(el, 'mm-settings-panel', '[data-key="src"] button')
    );
    choose.click();
    await vi.waitFor(() =>
      expect(el.getJson().body.rows[0].columns[0].blocks[0].values.src).toBe(
        'https://example.com/new.png',
      ),
    );
    expect(onImageSelect).toHaveBeenCalledWith({
      current: fixtures.basic.body.rows[0].columns[0].blocks[0].values.src,
    });
    // 代替テキストが既にあれば上書きしない
    expect(el.getJson().body.rows[0].columns[0].blocks[0].values.alt).toBe('秋の新作');
  });

  it('マージタグの候補を入力欄に挿入できる', async () => {
    const el = await mount({ mergeTags: [{ key: 'name', label: '氏名' }] });
    el.loadJson(fixtures.basic);
    el.select('b_button01');
    await frame();
    const input = /** @type {HTMLInputElement} */ (
      deep(el, 'mm-settings-panel', '[data-key="label"] input')
    );
    input.setSelectionRange(0, 0);
    const picker = /** @type {any} */ (
      deep(el, 'mm-settings-panel', '[data-key="label"] mm-merge-tag-picker')
    );
    picker.shadowRoot.querySelector('.toggle').click();
    await picker.updateComplete;
    const list = picker.shadowRoot.querySelector('mm-merge-tag-list');
    await list.updateComplete;
    list.shadowRoot.querySelector('[data-key="name"]').click();
    await frame();
    expect(el.getJson().body.rows[1].columns[0].blocks[1].values.label).toBe('{{name}}新作を見る');
  });
});

describe('パレット', () => {
  it('何も選択していなければ、1 カラムの行を末尾に作ってブロックを入れ、選択する', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    await frame();
    deep(el, 'mm-palette', '[data-block-type="text"]')?.click();
    await frame();
    const json = el.getJson();
    expect(json.body.rows).toHaveLength(5);
    const added = json.body.rows[4].columns[0].blocks[0];
    expect(added.type).toBe('text');
    expect(added.values.html).toBe('<p>テキストを入力してください。</p>');
    expect(el.store.getState().selection).toBe(added.id);
  });

  it('ブロックを選択中なら、その直後に入れる', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.select('b_text0001');
    await frame();
    deep(el, 'mm-palette', '[data-block-type="button"]')?.click();
    await frame();
    const blocks = el.getJson().body.rows[1].columns[0].blocks;
    expect(blocks.map((b) => b.type)).toEqual(['text', 'button', 'button']);
    expect(blocks[1].values.label).toBe('ボタン');
  });

  it('行タブのレイアウトで、選択中の行の直後に行を足す', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.select('b_button01');
    await frame();
    const tabs = deepAll(el, ['mm-palette'], '[role="tab"]');
    tabs[1].click();
    await frame();
    deep(el, 'mm-palette', '[data-layout="1:1:1"]')?.click();
    await frame();
    const rows = el.getJson().body.rows;
    expect(rows).toHaveLength(5);
    expect(rows[2].layout).toBe('1:1:1');
  });
});

describe('操作ボタンとキーボード', () => {
  it('選択中のブロックの削除ボタンで削除できる', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.select('b_button01');
    await frame();
    const block = canvasBlocks(el)[2];
    block.shadowRoot.querySelector('.chrome-actions button.danger').click();
    await frame();
    expect(el.getJson().body.rows[1].columns[0].blocks).toHaveLength(1);
  });

  it('行の複製ボタンで直後に複製し、複製を選択する', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.select('r_items001');
    await frame();
    const row = deepAll(el, ['mm-canvas'], 'mm-row')[2];
    const buttons = row.shadowRoot?.querySelectorAll('.chrome-actions button') ?? [];
    /** @type {HTMLButtonElement} */ (buttons[2]).click();
    await frame();
    const rows = el.getJson().body.rows;
    expect(rows).toHaveLength(5);
    expect(el.store.getState().selection).toBe(rows[3].id);
  });

  it('Delete で削除、Ctrl+Z で元に戻す、Ctrl+Shift+Z でやり直す', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.select('b_button01');
    press(el, 'Delete');
    expect(el.getJson().body.rows[1].columns[0].blocks).toHaveLength(1);
    press(el, 'z', { ctrlKey: true });
    expect(el.getJson().body.rows[1].columns[0].blocks).toHaveLength(2);
    press(el, 'z', { ctrlKey: true, shiftKey: true });
    expect(el.getJson().body.rows[1].columns[0].blocks).toHaveLength(1);
  });

  it('Alt+↑ / ↓ で並べ替え、Ctrl+D で複製、Esc で選択解除', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.select('b_button01');
    press(el, 'ArrowUp', { altKey: true });
    expect(el.getJson().body.rows[1].columns[0].blocks.map((b) => b.id)).toEqual([
      'b_button01',
      'b_text0001',
    ]);
    press(el, 'd', { ctrlKey: true });
    expect(el.getJson().body.rows[1].columns[0].blocks).toHaveLength(3);
    press(el, 'Escape');
    expect(el.store.getState().selection).toBeNull();
    el.select('r_footer01');
    press(el, 'ArrowUp', { altKey: true });
    expect(el.getJson().body.rows[2].id).toBe('r_footer01');
  });

  it('入力欄の中のキー操作はエディタのショートカットにしない', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.select('b_button01');
    await frame();
    const input = /** @type {HTMLInputElement} */ (
      deep(el, 'mm-settings-panel', '[data-key="label"] input')
    );
    press(input, 'Delete');
    expect(el.getJson().body.rows[1].columns[0].blocks).toHaveLength(2);
  });

  it('ツールバーの Undo / Redo ボタンは履歴に応じて使えるようになる', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    await frame();
    const undo = /** @type {HTMLButtonElement} */ (deep(el, 'mm-toolbar', '[data-action="undo"]'));
    expect(undo.disabled).toBe(true);
    el.store.dispatch({ type: 'removeRow', rowId: 'r_header01' });
    await frame();
    expect(undo.disabled).toBe(false);
    undo.click();
    await frame();
    expect(el.getJson().body.rows).toHaveLength(4);
    expect(
      /** @type {HTMLButtonElement} */ (deep(el, 'mm-toolbar', '[data-action="redo"]')).disabled,
    ).toBe(false);
  });
});

describe('出力', () => {
  it('exportHtml は core の renderHtml と同じ結果を返す', async () => {
    const el = await mount({ socialIconBaseUrl: 'https://cdn.example.com/icons' });
    el.loadJson(fixtures.kitchenSink);
    expect(el.exportHtml()).toBe(
      renderHtml(fixtures.kitchenSink, { socialIconBaseUrl: 'https://cdn.example.com/icons' }),
    );
    expect(el.exportHtml({ minify: true })).not.toContain('\n');
  });

  it('export は HTML とテキストをまとめて返す', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    const { html, text } = el.export({ text: { mergeValues: { name: '山田' } } });
    expect(html).toContain('<!DOCTYPE html');
    expect(text).toContain('山田 様');
  });

  it('mergeTags に無いマージタグを使っていると出力時に警告する', async () => {
    const el = await mount({ mergeTags: [{ key: 'name', label: '氏名' }] });
    el.loadJson(fixtures.basic);
    const listener = vi.fn();
    el.addEventListener('mm-warning', listener);
    el.exportHtml();
    const warnings = listener.mock.calls.map((call) => call[0].detail);
    expect(warnings).toEqual([
      expect.objectContaining({ code: 'unknown-merge-tag', key: 'unsubscribe_url' }),
    ]);
  });

  it('手編集のテキストが古くなっていれば警告する', async () => {
    const el = await mount();
    el.loadJson({
      ...fixtures.basic,
      text: { mode: 'manual', content: '手編集', sourceHash: 'x' },
    });
    const listener = vi.fn();
    el.addEventListener('mm-warning', listener);
    expect(el.exportText()).toBe('手編集');
    expect(listener.mock.calls[0][0].detail.code).toBe('stale-text');
  });
});

describe('表示言語とテーマ', () => {
  it('locale と messages で UI の文言を切り替える', async () => {
    const el = await mount({ locale: 'en', messages: { 'block.image': 'Picture' } });
    const label = (/** @type {string} */ type) =>
      deep(el, 'mm-palette', `[data-block-type="${type}"] span`)?.textContent;
    expect(label('text')).toBe('Text');
    expect(label('image')).toBe('Picture');
    el.locale = 'ja';
    el.messages = {};
    await el.updateComplete;
    await frame();
    expect(label('text')).toBe('テキスト');
  });

  it('color-mode 属性で配色を切り替える', async () => {
    const el = await mount({ colorMode: 'dark' });
    expect(el.getAttribute('color-mode')).toBe('dark');
    expect(getComputedStyle(el).getPropertyValue('--mm-color-surface').trim()).toBe('#1f2227');
  });
});
