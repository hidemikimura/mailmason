// Web フォント: 使っているものだけ head で読み込み、Outlook（Windows）には出さない
import { describe, expect, it } from 'vitest';
import {
  createBlock,
  createRow,
  createTemplate,
  migrate,
  renderHtml,
  validate,
} from '../../src/core/index.js';
import { fontFamilyNames, usedWebFonts } from '../../src/core/render-html/web-fonts.js';

const NOTO = {
  family: 'Noto Sans JP',
  url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap',
};
const SERIF = {
  family: 'Noto Serif JP',
  url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap',
};

/**
 * @param {Record<string, unknown>} body
 * @param {import('../../src/core/index.js').Block[]} [blocks]
 */
function template(body, blocks = [createBlock('text', { html: '<p>本文</p>' })]) {
  const t = createTemplate();
  Object.assign(t.body.settings, body);
  t.body.rows.push(createRow('1', [blocks]));
  return t;
}

/** head の中 */
const head = (/** @type {string} */ html) =>
  html.slice(html.indexOf('<head>'), html.indexOf('</head>'));

describe('Web フォント', () => {
  it('フォント名を取り出す（引用符を外し、小文字にする）', () => {
    expect(fontFamilyNames(`'Noto Sans JP', "Hiragino Sans", Meiryo , sans-serif`)).toEqual([
      'noto sans jp',
      'hiragino sans',
      'meiryo',
      'sans-serif',
    ]);
  });

  it('ボディのフォントで使うと、head で link と import を出す（Outlook（Windows）には出さない）', () => {
    const html = renderHtml(
      template({
        fontFamily: `'Noto Sans JP', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif`,
        webFonts: [NOTO, SERIF],
      }),
    );
    const h = head(html);
    expect(h).toMatch(
      /<!--\[if !mso\]><!-->\s*<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Noto\+Sans\+JP:wght@400;700&amp;display=swap" rel="stylesheet" type="text\/css" \/>\s*<style type="text\/css">@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Noto\+Sans\+JP:wght@400;700&display=swap'\);<\/style>\s*<!--<!\[endif\]-->/,
    );
    // 使っていないフォントは読み込まない
    expect(h).not.toContain('Noto+Serif+JP');
    // Outlook（Windows）は outlookFontFamily で上書きする（既存の仕組み）
    expect(h).toMatch(/<!--\[if mso\]>[\s\S]*font-family:Arial, sans-serif !important/);
  });

  it('テキストブロックのフォントで使ったものも読み込む。名前は大文字・小文字を区別しない', () => {
    const html = renderHtml(
      template({ webFonts: [NOTO, SERIF] }, [
        createBlock('text', { html: '<p>見出し</p>', fontFamily: '"noto serif jp", serif' }),
      ]),
    );
    expect(head(html)).toContain('Noto+Serif+JP');
    expect(head(html)).not.toContain('Noto+Sans+JP');
  });

  it('使っていなければ何も出さない（既定）。webFonts: false でも出さない', () => {
    expect(head(renderHtml(template({ webFonts: [NOTO] })))).not.toContain('<link');
    const used = template({ fontFamily: `'Noto Sans JP', sans-serif`, webFonts: [NOTO] });
    expect(head(renderHtml(used))).toContain('<link');
    expect(head(renderHtml(used, { webFonts: false }))).not.toContain('<link');
    expect(head(renderHtml(used, { webFonts: false }))).not.toContain('@import');
  });

  it('同じ URL は 1 回だけ', () => {
    const t = template({
      fontFamily: `'Noto Sans JP', 'Noto Sans JP 2', sans-serif`,
      webFonts: [NOTO, { ...NOTO, family: 'Noto Sans JP 2' }],
    });
    expect(usedWebFonts(t)).toHaveLength(1);
  });

  it('読み込み: https 以外の URL・名前の無い項目は警告して除く。古いテンプレートは警告なしで [] を補う', () => {
    const t = template({});
    const input = /** @type {any} */ (structuredClone(t));
    delete input.body.settings.webFonts;
    expect(migrate(input).warnings).toEqual([]);
    expect(migrate(input).template.body.settings.webFonts).toEqual([]);

    input.body.settings.webFonts = [
      NOTO,
      { family: 'Evil', url: 'http://example.com/font.css' },
      { family: 'Evil2', url: "https://example.com/a.css');}body{color:red" },
      { family: '', url: 'https://example.com/b.css' },
    ];
    const result = validate(input);
    expect(result.warnings.map((w) => w.path)).toEqual([
      'body.settings.webFonts[1].url',
      'body.settings.webFonts[2].url',
      'body.settings.webFonts[1]',
      'body.settings.webFonts[2]',
      'body.settings.webFonts[3]',
    ]);
    expect(migrate(input).template.body.settings.webFonts).toEqual([NOTO]);
  });
});
