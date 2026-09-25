// スマホ向けの設定: PC では表示しない（スマホだけに出す）・スマホの文字サイズ
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createBlock,
  createRow,
  createTemplate,
  migrate,
  renderHtml,
  renderText,
  validate,
} from '../../src/core/index.js';

/**
 * @param {import('../../src/core/index.js').Block[]} blocks
 * @param {Record<string, unknown>} [body]
 */
function template(blocks, body = {}) {
  const t = createTemplate();
  Object.assign(t.body.settings, body);
  t.body.rows.push(createRow('1', [blocks]));
  return t;
}

/** <style> の中のメディアクエリ */
const media = (/** @type {string} */ html) =>
  /@media only screen and \(max-width:\d+px\)\{([\s\S]*?)\n\s*\}/.exec(html)?.[1] ?? '';

describe('PC では表示しない（hideOn: "desktop"）', () => {
  it('ブロック: 行を PC では隠し、メディアクエリで表示する。Outlook（Windows）には出さない', () => {
    const block = createBlock('text', { html: '<p>アプリで開く</p>' });
    block.hideOn = 'desktop';
    const html = renderHtml(template([createBlock('text', { html: '<p>本文</p>' }), block]));
    expect(html).toMatch(
      /<!--\[if !mso\]><!-->\s*<tr class="mm-hide-desktop" style="display:none;mso-hide:all;">\s*<td[^>]*>\s*<div[^>]*>\s*<p[^>]*>アプリで開く<\/p>[\s\S]*?<\/tr>\s*<!--<!\[endif\]-->/,
    );
    expect(media(html)).toContain('.mm-hide-desktop{display:table-row !important;}');
    // もう一方のブロックはそのまま
    expect(html).toMatch(/<tr>\s*<td[^>]*>\s*<div[^>]*>\s*<p[^>]*>本文<\/p>/);
  });

  it('行: 行全体を PC では隠す', () => {
    const t = template([createBlock('text', { html: '<p>スマホ用の見出し</p>' })]);
    t.body.rows[0].settings.hideOn = 'desktop';
    const html = renderHtml(t);
    expect(html).toContain('<tr class="mm-hide-desktop" style="display:none;mso-hide:all;">');
    expect(html.indexOf('mm-hide-desktop"')).toBeLessThan(html.indexOf('スマホ用の見出し'));
  });

  it('テキストパートには出す（PC・スマホのどちらかだけの要素も含める）', () => {
    const block = createBlock('text', { html: '<p>アプリで開く</p>' });
    block.hideOn = 'desktop';
    expect(renderText(template([block]))).toContain('アプリで開く');
  });

  it('読み込みとコマンドで "desktop" を受け付け、ほかの値は直す', () => {
    const t = template([createBlock('spacer')]);
    const input = /** @type {any} */ (structuredClone(t));
    input.body.rows[0].settings.hideOn = 'desktop';
    input.body.rows[0].columns[0].blocks[0].hideOn = 'tablet';
    const result = validate(input);
    expect(result.warnings.map((w) => w.path)).toEqual([
      'body.rows[0].columns[0].blocks[0].hideOn',
    ]);
    const fixed = migrate(input).template;
    expect(fixed.body.rows[0].settings.hideOn).toBe('desktop');
    expect(fixed.body.rows[0].columns[0].blocks[0].hideOn).toBeNull();

    const blockId = t.body.rows[0].columns[0].blocks[0].id;
    const next = applyCommand(t, { type: 'setBlockHideOn', blockId, hideOn: 'desktop' });
    expect(next.body.rows[0].columns[0].blocks[0].hideOn).toBe('desktop');
  });
});

describe('スマホの文字サイズ', () => {
  it('指定が無ければクラスも規則も出さない（既定）', () => {
    const html = renderHtml(
      template([
        createBlock('text', { html: '<h1>見出し</h1><p>本文</p>' }),
        createBlock('button', { label: '購入', href: 'https://example.com/' }),
      ]),
    );
    expect(html).not.toMatch(/mm-f\d/);
  });

  it('メール全体: 文字サイズを指定していないテキストに、段落・見出し・リストごとのクラスを付ける', () => {
    const html = renderHtml(
      template(
        [createBlock('text', { html: '<h1>見出し</h1><p>本文</p><ul><li>項目</li></ul>' })],
        {
          mobileFontSize: 18,
        },
      ),
    );
    // 本文 18px × 1.6 = 28.8 → 29px、見出し h1 は 18 × 1.75 = 31.5 → 32px（行の高さ 1.4 倍）
    expect(html).toMatch(/<p class="mm-f18-29" style="[^"]*font-size:16px;line-height:26px;/);
    expect(html).toMatch(/<h1 class="mm-f32-45" style="[^"]*font-size:28px;/);
    expect(html).toMatch(/<ul class="mm-f18-29"/);
    expect(html).toMatch(/<li class="mm-f18-29"/);
    const rules = media(html);
    expect(rules).toContain('.mm-f18-29{font-size:18px !important;line-height:29px !important;}');
    expect(rules).toContain('.mm-f32-45{font-size:32px !important;line-height:45px !important;}');
    // 同じ規則は 1 回だけ
    expect(rules.match(/\.mm-f18-29\{/g)).toHaveLength(1);
  });

  it('ブロックの文字サイズを指定したテキストは、ブロックのスマホの文字サイズが無ければ PC と同じ', () => {
    const html = renderHtml(
      template(
        [
          createBlock('text', { html: '<p>大きい</p>', fontSize: 20 }),
          createBlock('text', { html: '<p>小さく</p>', fontSize: 20, mobileFontSize: 15 }),
          createBlock('text', { html: '<p>本文と同じ</p>', mobileFontSize: 16 }),
        ],
        { mobileFontSize: 18 },
      ),
    );
    expect(html).toMatch(/<p style="[^"]*font-size:20px;[^"]*">大きい/);
    expect(html).toMatch(/<p class="mm-f15-24" [^>]*>小さく/);
    // PC と同じ大きさならクラスを付けない
    expect(html).toMatch(/<p style="[^"]*">本文と同じ/);
  });

  it('ボタン・ボタンの並び・メニュー・表・画像＋テキスト・SNS のテキストリンク', () => {
    const table = createBlock('table', {
      cells: [
        ['a', 'b'],
        ['c', 'd'],
      ],
      mobileLayout: 'stack',
    });
    const html = renderHtml(
      template(
        [
          createBlock('button', {
            label: '購入',
            href: 'https://example.com/',
            mobileFontSize: 18,
          }),
          createBlock('buttons', {
            items: [{ label: 'A', href: 'https://example.com/a' }],
            mobileFontSize: 14,
          }),
          createBlock('menu', {
            items: [{ label: '新着', href: 'https://example.com/new' }],
            mobileFontSize: 12,
          }),
          table,
          createBlock('imageText', {
            html: '<p>説明</p>',
            image: {
              src: 'https://example.com/a.jpg',
              alt: 'a',
              naturalWidth: 100,
              naturalHeight: 100,
            },
          }),
          createBlock('social', { items: [{ service: 'x', url: 'https://x.com/a' }] }),
        ],
        { mobileFontSize: 15 },
      ),
    );
    // ボタンの行の高さは文字サイズの 1.25 倍（Outlook の VML ボタンは変えない）
    expect(html).toMatch(/<a href="https:\/\/example\.com\/" target="_blank" class="mm-f18-23"/);
    expect(html).toMatch(/<a href="https:\/\/example\.com\/a" target="_blank" class="mm-f14-18"/);
    expect(html).toMatch(/<p class="mm-f12-19"[^>]*><a href="https:\/\/example\.com\/new"/);
    // 表（文字サイズ未指定）: 本文のスマホの文字サイズ、行の高さは 1.5 倍まで
    expect(html).toMatch(/<th scope="col" class="mm-f15-23"/);
    expect(html).toMatch(/<td class="mm-f15-23"/);
    expect(html).toContain('<table class="mm-table-stack mm-f15-23" role="presentation"');
    expect(html).toMatch(/<p class="mm-f15-24"[^>]*>説明<\/p>/);
    expect(html).toMatch(/<p class="mm-f15-24"[^>]*><a href="https:\/\/x\.com\/a"/);
  });

  it('読み込み: 古いテンプレート（項目なし）は警告なしで null を補い、不正な値は null にする', () => {
    const t = template([createBlock('text', { html: '<p>a</p>' })]);
    const input = /** @type {any} */ (structuredClone(t));
    delete input.body.settings.mobileFontSize;
    delete input.body.rows[0].columns[0].blocks[0].values.mobileFontSize;
    const old = migrate(input);
    expect(old.warnings).toEqual([]);
    expect(old.template.body.settings.mobileFontSize).toBeNull();
    expect(old.template.body.rows[0].columns[0].blocks[0].values.mobileFontSize).toBeNull();

    input.body.settings.mobileFontSize = 200;
    expect(validate(input).warnings.map((w) => w.path)).toEqual(['body.settings.mobileFontSize']);
    expect(migrate(input).template.body.settings.mobileFontSize).toBeNull();
  });
});
