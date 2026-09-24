import { describe, expect, it } from 'vitest';
import { createTemplate, renderHtml } from '../../src/core/index.js';
import { loadFixture } from './helpers.js';

/**
 * 出力 HTML がメール向けの規約を守っているかを検査する
 * @param {string} html
 */
function assertEmailRules(html) {
  // レイアウトに使えない CSS
  expect(html).not.toMatch(/display:\s*(flex|grid)|float:|position:\s*(absolute|fixed)/);
  // 画像には必ず alt と width
  for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
    expect(img).toMatch(/\salt="/);
    expect(img).toMatch(/\swidth="\d+"/);
  }
  // テーブルはすべてレイアウト用
  for (const table of html.match(/<table\b[^>]*>/g) ?? []) {
    expect(table).toContain('role="presentation"');
  }
  // <style> の中の .mm- クラスはメディアクエリの中だけ
  const style = /<style type="text\/css">\s*(body[\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
  const outsideMedia = style.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, '');
  expect(outsideMedia).not.toMatch(/\.mm-/);
}

describe('renderHtml', () => {
  it('basic フィクスチャ（整形出力）', async () => {
    const html = renderHtml(loadFixture('basic'));
    assertEmailRules(html);
    await expect(html).toMatchFileSnapshot('./__snapshots__/basic.html');
  });

  it('kitchen-sink フィクスチャ（SNS アイコンあり）', async () => {
    const input = loadFixture('kitchen-sink');
    const options = { socialIconBaseUrl: 'https://example.com/icons/' };
    await expect(renderHtml(input, options)).toMatchFileSnapshot(
      './__snapshots__/kitchen-sink.html',
    );
    // 生 HTML ブロックの中身は利用者の責任なので、規約の検査からは外す
    input.body.rows[3].columns[0].blocks[2].values.html = '';
    assertEmailRules(renderHtml(input, options));
  });

  it('同じ入力からは常に同じ出力になる', () => {
    const input = loadFixture('kitchen-sink');
    expect(renderHtml(input)).toBe(renderHtml(structuredClone(input)));
  });

  it('JSON 文字列もそのまま渡せる', () => {
    const input = loadFixture('basic');
    expect(renderHtml(JSON.stringify(input))).toBe(renderHtml(input));
  });

  it('minify では改行とインデントを入れず、中身は同じ', () => {
    const input = loadFixture('basic');
    const min = renderHtml(input, { minify: true });
    expect(min).not.toContain('\n');
    expect(min.length).toBeLessThan(renderHtml(input).length);
    expect(min.replace(/\s+/g, '')).toBe(renderHtml(input).replace(/\s+/g, ''));
  });

  it('XHTML の DOCTYPE・Outlook 用の名前空間・color-scheme を出す', () => {
    const html = renderHtml(createTemplate());
    expect(html.startsWith('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"')).toBe(
      true,
    );
    expect(html).toContain('xmlns:v="urn:schemas-microsoft-com:vml"');
    expect(html).toContain('<meta name="color-scheme" content="light dark" />');
    expect(html).toContain('lang="ja"');
  });

  it('本文幅に合わせてメディアクエリの境界と外枠の幅を決める', () => {
    const html = renderHtml(createTemplate({ width: 640 }));
    expect(html).toContain('@media only screen and (max-width:660px)');
    expect(html).toContain('width="640"');
    expect(html).toContain('max-width:640px');
  });

  it('プリヘッダーは非表示の要素として本文の先頭に置く', () => {
    const html = renderHtml(loadFixture('basic'));
    expect(html).toMatch(
      /<div style="display:none;[^"]*mso-hide:all;">秋の新作アイテムのご案内です&#847;/,
    );
  });

  it('mergeValues を指定するとマージタグを HTML エスケープして置き換える', () => {
    const html = renderHtml(loadFixture('basic'), {
      mergeValues: { name: '<山田> & 太郎', unsubscribe_url: 'https://a.jp/?a=1&b=2' },
    });
    expect(html).toContain('&lt;山田&gt; &amp; 太郎 様');
    expect(html).toContain('href="https://a.jp/?a=1&amp;b=2"');
    expect(html).not.toContain('{{');
  });

  it('マージタグは指定が無ければそのまま残す', () => {
    const html = renderHtml(loadFixture('basic'));
    expect(html).toContain('{{name}} 様');
    expect(html).toContain('href="{{unsubscribe_url}}"');
  });

  it('ボタンは VML と通常のリンクの両方を出す', () => {
    const html = renderHtml(loadFixture('basic'));
    expect(html).toMatch(
      /<v:roundrect [^>]*href="https:\/\/example.com\/new"[^>]*fillcolor="#e8590c">/,
    );
    expect(html).toContain('<!--[if !mso]><!-->');
    expect(html).toMatch(
      /<a href="https:\/\/example.com\/new" target="_blank" style="display:inline-block;background-color:#e8590c;/,
    );
  });

  it('画像は表示幅と縦横比から width / height を決める', () => {
    const html = renderHtml(loadFixture('basic'));
    expect(html).toContain('alt="秋の新作" width="600" height="300"');
    // 2 カラム（内容幅 268px）× 40% の画像
    expect(html).toContain('alt="ニットカーディガン" width="99" height="99"');
  });

  it('複数カラムの行はスマホで縦積みにし、stackOnMobile: false の行はしない', () => {
    const html = renderHtml(loadFixture('kitchen-sink'));
    const rows = html.split('<td style="padding:');
    expect(html).toContain('class="mm-col" width="');
    // 2:1 の行（stackOnMobile: false）のカラムには mm-col を付けない
    expect(html).toMatch(
      /<td width="\d+" valign="top" style="width:\d+px;padding:0 8px 0 0;vertical-align:top;">/,
    );
    expect(rows.length).toBeGreaterThan(1);
  });

  it('hideOn: mobile の行・ブロックに非表示クラスを付ける', () => {
    const html = renderHtml(loadFixture('kitchen-sink'));
    expect(html).toContain('<tr class="mm-hide-mobile">'); // ブロック
    expect(html).toMatch(/<td class="mm-hide-mobile"/); // 行
  });

  it('画像を右に置く「画像＋テキスト」は dir="rtl" で並べる', () => {
    const html = renderHtml(loadFixture('kitchen-sink'));
    expect(html).toMatch(/<table role="presentation"[^>]* dir="rtl">/);
    expect(html).toMatch(/<td class="mm-col mm-it-text"[^>]*dir="ltr"[^>]*padding-right:12px;/);
  });

  it('SNS はアイコンの置き場所が無ければテキストリンクにする', () => {
    const input = loadFixture('kitchen-sink');
    expect(renderHtml(input)).toContain('>LINE</a> | <a');
    const withIcons = renderHtml(input, { socialIconBaseUrl: 'https://cdn.example.com/icons/' });
    expect(withIcons).toContain(
      'src="https://cdn.example.com/icons/line-mono.png" alt="LINE" width="24" height="24"',
    );
    expect(withIcons).not.toContain('youtube'); // URL が空の項目は出さない
  });

  it('画像の無い画像ブロック・ラベルの無いボタン・未知のブロックは出力しない', () => {
    const input = loadFixture('kitchen-sink');
    input.body.rows[0].columns[0].blocks.push({ id: 'b_unknown01', type: 'video', values: {} });
    const html = renderHtml(input);
    expect(html).not.toContain('空の画像');
    expect(html).not.toContain('https://example.com/empty');
    expect(html).not.toContain('video');
  });

  it('Outlook 用のフォントを指定できる', () => {
    const html = renderHtml(createTemplate(), { outlookFontFamily: 'Meiryo, sans-serif' });
    expect(html).toContain('font-family:Meiryo, sans-serif !important;');
  });
});
